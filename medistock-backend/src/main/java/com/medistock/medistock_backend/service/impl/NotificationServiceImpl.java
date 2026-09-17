package com.medistock.medistock_backend.service.impl;

import com.medistock.medistock_backend.dto.NotificationCountDto;
import com.medistock.medistock_backend.dto.NotificationDto;
import com.medistock.medistock_backend.entity.*;
import com.medistock.medistock_backend.repository.*;
import com.medistock.medistock_backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final SupplierMedicineRepository supplierMedicineRepository;
    private final MedicineRepository medicineRepository;
    private final UserRepository userRepository;
    private final SupplierRepository supplierRepository;

    @Value("${inventory.near-expiry-days:30}")
    private int nearExpiryDays;

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getNotificationsForCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return new ArrayList<>();
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return new ArrayList<>();
        }

        boolean isSupplier = user.getRoles().stream().anyMatch(r -> r.getName() == ERole.ROLE_SUPPLIER);

        if (isSupplier) {
            return getSupplierNotifications(user);
        } else {
            return getPharmacyWideNotifications();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationCountDto getNotificationCountForCurrentUser() {
        List<NotificationDto> notifications = getNotificationsForCurrentUser();
        long criticalCount = notifications.stream().filter(n -> "CRITICAL".equals(n.getType())).count();
        long warningCount = notifications.stream().filter(n -> "WARNING".equals(n.getType())).count();

        return NotificationCountDto.builder()
                .totalCount(notifications.size())
                .criticalCount(criticalCount)
                .warningCount(warningCount)
                .build();
    }

    private List<NotificationDto> getSupplierNotifications(User user) {
        List<NotificationDto> alerts = new ArrayList<>();
        Supplier supplier = supplierRepository.findByUserId(user.getId()).orElse(null);
        if (supplier == null && user.getEmail() != null) {
            supplier = supplierRepository.findByEmail(user.getEmail()).orElse(null);
        }
        if (supplier == null) {
            return alerts;
        }

        List<SupplierMedicine> supplierMedicines = supplierMedicineRepository.findBySupplierId(supplier.getId());
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryDate = today.plusDays(nearExpiryDays);

        for (SupplierMedicine sm : supplierMedicines) {
            int qty = sm.getAvailableQuantity() != null ? sm.getAvailableQuantity() : 0;
            int reorder = 10;
            String code = sm.getCode() != null ? sm.getCode() : "N/A";
            String supplierName = supplier.getName();

            // 1. Expiry Check
            if (sm.getExpiryDate() != null) {
                if (sm.getExpiryDate().isBefore(today)) {
                    alerts.add(NotificationDto.builder()
                            .id("exp-sm-" + sm.getId())
                            .type("CRITICAL")
                            .category("EXPIRY")
                            .title("Critical Expiry Alert")
                            .message("Supplied batch of \"" + sm.getName() + "\" (Code: " + code + ") has EXPIRED on " + sm.getExpiryDate() + ".")
                            .medicineId(sm.getId())
                            .medicineName(sm.getName())
                            .medicineCode(code)
                            .supplierId(supplier.getId())
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(sm.getExpiryDate())
                            .build());
                } else if (qty > 0 && !sm.getExpiryDate().isAfter(nearExpiryDate)) {
                    alerts.add(NotificationDto.builder()
                            .id("near-exp-sm-" + sm.getId())
                            .type("WARNING")
                            .category("EXPIRY")
                            .title("Near Expiry Warning")
                            .message("Supplied batch of \"" + sm.getName() + "\" (Code: " + code + ") is nearing expiration on " + sm.getExpiryDate() + " (under " + nearExpiryDays + " days).")
                            .medicineId(sm.getId())
                            .medicineName(sm.getName())
                            .medicineCode(code)
                            .supplierId(supplier.getId())
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(sm.getExpiryDate())
                            .build());
                }
            }

            // 2. Stock Level Check (OUT OF STOCK vs LOW STOCK)
            if (qty == 0) {
                alerts.add(NotificationDto.builder()
                        .id("oos-sm-" + sm.getId())
                        .type("CRITICAL")
                        .category("STOCK")
                        .title("Critical Out-Of-Stock Alert")
                        .message("Supplied formulation \"" + sm.getName() + "\" (Code: " + code + ") is OUT OF STOCK. Please replenish availability immediately.")
                        .medicineId(sm.getId())
                        .medicineName(sm.getName())
                        .medicineCode(code)
                        .supplierId(supplier.getId())
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(sm.getExpiryDate())
                        .build());
            } else if (qty <= reorder) {
                alerts.add(NotificationDto.builder()
                        .id("low-sm-" + sm.getId())
                        .type("WARNING")
                        .category("STOCK")
                        .title("Low Stock Warning")
                        .message("Supply alert: Formulation \"" + sm.getName() + "\" (Code: " + code + ") is in LOW STOCK with only " + qty + " units remaining (Reorder: " + reorder + ").")
                        .medicineId(sm.getId())
                        .medicineName(sm.getName())
                        .medicineCode(code)
                        .supplierId(supplier.getId())
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(sm.getExpiryDate())
                        .build());
            }
        }

        return alerts;
    }

    private List<NotificationDto> getPharmacyWideNotifications() {
        List<NotificationDto> alerts = new ArrayList<>();
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryDate = today.plusDays(nearExpiryDays);
        Set<String> processedCodes = new HashSet<>();

        // Pre-fetch all medicines into memory once to eliminate N+1 queries inside the loop
        List<Medicine> allMedicines = medicineRepository.findAll();
        java.util.Map<String, Medicine> medicineByCodeMap = allMedicines.stream()
                .filter(m -> m.getCode() != null)
                .collect(Collectors.toMap(
                        Medicine::getCode,
                        m -> m,
                        (existing, replacement) -> existing
                ));

        // 1. Process all supplier-specific inventory records (covers multiple suppliers per medicine formulation)
        List<SupplierMedicine> supplierMedicines = supplierMedicineRepository.findAll();
        for (SupplierMedicine sm : supplierMedicines) {
            String supplierName = sm.getSupplier() != null ? sm.getSupplier().getName() : "Supplier";
            Long supplierId = sm.getSupplier() != null ? sm.getSupplier().getId() : null;
            int reorder = 10;
            String code = sm.getCode() != null ? sm.getCode() : "N/A";
            if (sm.getCode() != null) {
                processedCodes.add(sm.getCode());
            }

            int qty = 0;
            if (sm.getCode() != null) {
                Medicine med = medicineByCodeMap.get(sm.getCode());
                if (med != null && med.getInventory() != null && med.getInventory().getQuantity() != null) {
                    qty = med.getInventory().getQuantity();
                    if (med.getInventory().getReorderLevel() != null) {
                        reorder = med.getInventory().getReorderLevel();
                    }
                } else if (sm.getAvailableQuantity() != null) {
                    qty = sm.getAvailableQuantity();
                }
            } else if (sm.getAvailableQuantity() != null) {
                qty = sm.getAvailableQuantity();
            }

            // Expiry Check
            if (sm.getExpiryDate() != null) {
                if (sm.getExpiryDate().isBefore(today)) {
                    alerts.add(NotificationDto.builder()
                            .id("exp-sm-" + sm.getId())
                            .type("CRITICAL")
                            .category("EXPIRY")
                            .title("Critical Expiry Alert")
                            .message("\"" + sm.getName() + "\" (Code: " + code + ") from " + supplierName + " has EXPIRED on " + sm.getExpiryDate() + ".")
                            .medicineId(sm.getId())
                            .medicineName(sm.getName())
                            .medicineCode(code)
                            .supplierId(supplierId)
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(sm.getExpiryDate())
                            .build());
                } else if (qty > 0 && !sm.getExpiryDate().isAfter(nearExpiryDate)) {
                    alerts.add(NotificationDto.builder()
                            .id("near-exp-sm-" + sm.getId())
                            .type("WARNING")
                            .category("EXPIRY")
                            .title("Near Expiry Warning")
                            .message("\"" + sm.getName() + "\" (Code: " + code + ") from " + supplierName + " is nearing expiry on " + sm.getExpiryDate() + " (under " + nearExpiryDays + " days).")
                            .medicineId(sm.getId())
                            .medicineName(sm.getName())
                            .medicineCode(code)
                            .supplierId(supplierId)
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(sm.getExpiryDate())
                            .build());
                }
            }

            // Stock Check (Strict: OUT OF STOCK vs LOW STOCK)
            if (qty == 0) {
                alerts.add(NotificationDto.builder()
                        .id("oos-sm-" + sm.getId())
                        .type("CRITICAL")
                        .category("STOCK")
                        .title("Critical Out-Of-Stock Alert")
                        .message("\"" + sm.getName() + "\" (Code: " + code + ") from " + supplierName + " is OUT OF STOCK.")
                        .medicineId(sm.getId())
                        .medicineName(sm.getName())
                        .medicineCode(code)
                        .supplierId(supplierId)
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(sm.getExpiryDate())
                        .build());
            } else if (qty <= reorder) {
                alerts.add(NotificationDto.builder()
                        .id("low-sm-" + sm.getId())
                        .type("WARNING")
                        .category("STOCK")
                        .title("Low Stock Warning")
                        .message("\"" + sm.getName() + "\" (Code: " + code + ") from " + supplierName + " is LOW STOCK with only " + qty + " units remaining (Reorder: " + reorder + ").")
                        .medicineId(sm.getId())
                        .medicineName(sm.getName())
                        .medicineCode(code)
                        .supplierId(supplierId)
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(sm.getExpiryDate())
                        .build());
            }
        }

        // 2. Process any main pharmacy medicine inventory records not covered in SupplierMedicine
        for (Medicine med : allMedicines) {
            if (med.getCode() != null && processedCodes.contains(med.getCode())) {
                continue; // Already processed via SupplierMedicine
            }

            String supplierName = med.getSupplier() != null ? med.getSupplier().getName() : "Pharmacy Inventory";
            Long supplierId = med.getSupplier() != null ? med.getSupplier().getId() : null;
            int qty = med.getInventory() != null && med.getInventory().getQuantity() != null ? med.getInventory().getQuantity() : 0;
            int reorder = med.getInventory() != null && med.getInventory().getReorderLevel() != null ? med.getInventory().getReorderLevel() : 10;
            String code = med.getCode() != null ? med.getCode() : "N/A";

            // Expiry Check
            if (med.getExpiryDate() != null) {
                if (med.getExpiryDate().isBefore(today)) {
                    alerts.add(NotificationDto.builder()
                            .id("exp-m-" + med.getId())
                            .type("CRITICAL")
                            .category("EXPIRY")
                            .title("Critical Expiry Alert")
                            .message("\"" + med.getName() + "\" (Code: " + code + ") from " + supplierName + " has EXPIRED on " + med.getExpiryDate() + ".")
                            .medicineId(med.getId())
                            .medicineName(med.getName())
                            .medicineCode(code)
                            .supplierId(supplierId)
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(med.getExpiryDate())
                            .build());
                } else if (qty > 0 && !med.getExpiryDate().isAfter(nearExpiryDate)) {
                    alerts.add(NotificationDto.builder()
                            .id("near-exp-m-" + med.getId())
                            .type("WARNING")
                            .category("EXPIRY")
                            .title("Near Expiry Warning")
                            .message("\"" + med.getName() + "\" (Code: " + code + ") from " + supplierName + " is nearing expiry on " + med.getExpiryDate() + " (under " + nearExpiryDays + " days).")
                            .medicineId(med.getId())
                            .medicineName(med.getName())
                            .medicineCode(code)
                            .supplierId(supplierId)
                            .supplierName(supplierName)
                            .quantity(qty)
                            .reorderLevel(reorder)
                            .expiryDate(med.getExpiryDate())
                            .build());
                }
            }

            // Stock Check
            if (qty == 0) {
                alerts.add(NotificationDto.builder()
                        .id("oos-m-" + med.getId())
                        .type("CRITICAL")
                        .category("STOCK")
                        .title("Critical Out-Of-Stock Alert")
                        .message("\"" + med.getName() + "\" (Code: " + code + ") from " + supplierName + " is OUT OF STOCK.")
                        .medicineId(med.getId())
                        .medicineName(med.getName())
                        .medicineCode(code)
                        .supplierId(supplierId)
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(med.getExpiryDate())
                        .build());
            } else if (qty <= reorder) {
                alerts.add(NotificationDto.builder()
                        .id("low-m-" + med.getId())
                        .type("WARNING")
                        .category("STOCK")
                        .title("Low Stock Warning")
                        .message("\"" + med.getName() + "\" (Code: " + code + ") from " + supplierName + " is LOW STOCK with only " + qty + " units remaining (Reorder: " + reorder + ").")
                        .medicineId(med.getId())
                        .medicineName(med.getName())
                        .medicineCode(code)
                        .supplierId(supplierId)
                        .supplierName(supplierName)
                        .quantity(qty)
                        .reorderLevel(reorder)
                        .expiryDate(med.getExpiryDate())
                        .build());
            }
        }

        return alerts;
    }
}
