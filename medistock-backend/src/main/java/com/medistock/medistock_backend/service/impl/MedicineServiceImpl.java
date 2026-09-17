package com.medistock.medistock_backend.service.impl;

import java.math.BigDecimal;
import java.util.Optional;
import com.medistock.medistock_backend.dto.CategoryDto;
import com.medistock.medistock_backend.dto.MedicineFilterRequest;
import com.medistock.medistock_backend.dto.MedicineRequest;
import com.medistock.medistock_backend.dto.MedicineResponse;
import com.medistock.medistock_backend.dto.SupplierDto;
import com.medistock.medistock_backend.entity.Category;
import com.medistock.medistock_backend.entity.Inventory;
import com.medistock.medistock_backend.entity.Medicine;
import com.medistock.medistock_backend.entity.Supplier;
import com.medistock.medistock_backend.entity.Batch;
import com.medistock.medistock_backend.entity.StockMovement;
import com.medistock.medistock_backend.entity.StockStatus;
import com.medistock.medistock_backend.exception.BadRequestException;
import com.medistock.medistock_backend.exception.ResourceNotFoundException;
import com.medistock.medistock_backend.entity.ERole;
import com.medistock.medistock_backend.entity.User;
import com.medistock.medistock_backend.entity.SupplierMedicine;
import com.medistock.medistock_backend.repository.CategoryRepository;
import com.medistock.medistock_backend.repository.InventoryRepository;
import com.medistock.medistock_backend.repository.MedicineRepository;
import com.medistock.medistock_backend.repository.SupplierMedicineRepository;
import com.medistock.medistock_backend.repository.UserRepository;
import com.medistock.medistock_backend.service.StockMovementService;
import com.medistock.medistock_backend.entity.MovementType;
import com.medistock.medistock_backend.repository.BatchRepository;
import com.medistock.medistock_backend.repository.StockMovementRepository;
import com.medistock.medistock_backend.repository.SupplierRepository;
import com.medistock.medistock_backend.service.MedicineService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MedicineServiceImpl implements MedicineService {

    private final MedicineRepository medicineRepository;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;
    private final InventoryRepository inventoryRepository;
    private final StockMovementService stockMovementService;
    private final UserRepository userRepository;
    private final SupplierMedicineRepository supplierMedicineRepository;
    private final BatchRepository batchRepository;
    private final StockMovementRepository stockMovementRepository;

    @Value("${inventory.near-expiry-days:30}")
    private int nearExpiryDays;

    @Override
    @Transactional(readOnly = true)
    public Page<MedicineResponse> getAllMedicines(MedicineFilterRequest filter) {
        Long currentSupplierId = getCurrentSupplierId();
        Long supplierId = currentSupplierId != null ? currentSupplierId : filter.getSupplierId();

        int pageNum = filter.getPage() != null ? filter.getPage() : 0;
        int pageSize = filter.getSize() != null ? filter.getSize() : 10;

        Sort sort = Sort.unsorted();
        if (filter.getSortBy() != null) {
            String sortByProperty = "name";
            switch (filter.getSortBy()) {
                case NAME:
                    sortByProperty = "name";
                    break;
                case QUANTITY:
                    sortByProperty = (currentSupplierId != null) ? "availableQuantity" : "inventory.quantity";
                    break;
                case EXPIRY_DATE:
                    sortByProperty = "expiryDate";
                    break;
                case CATEGORY:
                    sortByProperty = "category.name";
                    break;
                case SUPPLIER:
                    sortByProperty = "supplier.name";
                    break;
            }

            Sort.Direction direction = Sort.Direction.ASC;
            if (filter.getSortDirection() != null && filter.getSortDirection() == com.medistock.medistock_backend.entity.SortDirection.DESC) {
                direction = Sort.Direction.DESC;
            }
            sort = Sort.by(direction, sortByProperty);
        }

        Pageable pageable = PageRequest.of(pageNum, pageSize, sort);
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryDate = today.plusDays(nearExpiryDays);
        String statusStr = filter.getStockStatus() != null ? filter.getStockStatus().name() : "ALL";

        if (currentSupplierId != null) {
            Page<SupplierMedicine> page = supplierMedicineRepository.filterSupplierMedicines(
                currentSupplierId,
                filter.getSearch(),
                filter.getCategoryId(),
                statusStr,
                today,
                nearExpiryDate,
                pageable
            );
            return page.map(this::mapSupplierMedicineToResponse);
        } else {
            Page<Medicine> page = medicineRepository.filterMedicines(
                filter.getSearch(),
                filter.getCategoryId(),
                supplierId,
                statusStr,
                today,
                nearExpiryDate,
                pageable
            );
            java.util.Map<String, SupplierMedicine> supplierMedMap = buildSupplierMedicineMap();
            return page.map(m -> mapToResponseWithMap(m, supplierMedMap));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicineResponse> getAllMedicinesList(MedicineFilterRequest filter) {
        Long currentSupplierId = getCurrentSupplierId();
        Long supplierId = currentSupplierId != null ? currentSupplierId : filter.getSupplierId();
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryDate = today.plusDays(nearExpiryDays);
        String statusStr = filter.getStockStatus() != null ? filter.getStockStatus().name() : "ALL";

        if (currentSupplierId != null) {
            List<SupplierMedicine> list = supplierMedicineRepository.filterSupplierMedicinesList(
                currentSupplierId,
                filter.getSearch(),
                filter.getCategoryId(),
                statusStr,
                today,
                nearExpiryDate
            );
            return list.stream()
                    .map(this::mapSupplierMedicineToResponse)
                    .collect(Collectors.toList());
        } else {
            List<Medicine> list = medicineRepository.filterMedicinesList(
                filter.getSearch(),
                filter.getCategoryId(),
                supplierId,
                statusStr,
                today,
                nearExpiryDate
            );
            java.util.Map<String, SupplierMedicine> supplierMedMap = buildSupplierMedicineMap();
            return list.stream()
                    .map(m -> mapToResponseWithMap(m, supplierMedMap))
                    .collect(Collectors.toList());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MedicineResponse getMedicineById(Long id) {
        Long currentSupplierId = getCurrentSupplierId();
        if (currentSupplierId != null) {
            SupplierMedicine sm = supplierMedicineRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier medicine not found with id: " + id));
            return mapSupplierMedicineToResponse(sm);
        }
        Medicine medicine = medicineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found with id: " + id));
        return mapToResponse(medicine);
    }

    @Override
    @Transactional(readOnly = true)
    public MedicineResponse getMedicineByCode(String code) {
        Long currentSupplierId = getCurrentSupplierId();
        if (currentSupplierId != null) {
            SupplierMedicine sm = supplierMedicineRepository.findBySupplierIdAndCode(currentSupplierId, code)
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier medicine not found with code: " + code));
            return mapSupplierMedicineToResponse(sm);
        }
        Medicine medicine = medicineRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found with code: " + code));
        return mapToResponse(medicine);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicineResponse> searchMedicines(String query) {
        Long currentSupplierId = getCurrentSupplierId();
        if (currentSupplierId != null) {
            List<SupplierMedicine> list = supplierMedicineRepository.findBySupplierId(currentSupplierId);
            return list.stream()
                    .filter(sm -> sm.getName().toLowerCase().contains(query.toLowerCase())
                            || sm.getCode().toLowerCase().contains(query.toLowerCase())
                            || (sm.getGenericName() != null && sm.getGenericName().toLowerCase().contains(query.toLowerCase())))
                    .map(this::mapSupplierMedicineToResponse)
                    .collect(Collectors.toList());
        }
        return medicineRepository.searchMedicines(query).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MedicineResponse> getMedicinesByCategory(Long categoryId) {
        Long currentSupplierId = getCurrentSupplierId();
        if (currentSupplierId != null) {
            List<SupplierMedicine> list = supplierMedicineRepository.findBySupplierId(currentSupplierId);
            return list.stream()
                    .filter(sm -> sm.getCategory() != null && sm.getCategory().getId().equals(categoryId))
                    .map(this::mapSupplierMedicineToResponse)
                    .collect(Collectors.toList());
        }
        return medicineRepository.findByCategoryId(categoryId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public MedicineResponse createMedicine(MedicineRequest request) {
        if (medicineRepository.findByCode(request.getCode()).isPresent()) {
            throw new BadRequestException("Medicine code already exists: " + request.getCode());
        }

        Category category = null;
        if (request.getCategoryId() != null) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + request.getCategoryId()));
        }

        Supplier supplier = null;
        if (request.getSupplierId() != null) {
            supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with id: " + request.getSupplierId()));
        }

        BigDecimal effectiveUnitPrice = request.getUnitPrice();
        BigDecimal effectiveSellingPrice = request.getSellingPrice() != null ? request.getSellingPrice() : request.getPrice();

        Medicine medicine = Medicine.builder()
                .name(request.getName())
                .code(request.getCode())
                .genericName(request.getGenericName())
                .manufacturer(request.getManufacturer())
                .unitPrice(effectiveUnitPrice)
                .sellingPrice(effectiveSellingPrice)
                .price(request.getPrice() != null ? request.getPrice() : effectiveSellingPrice)
                .expiryDate(request.getExpiryDate())
                .batchNumber(request.getBatchNumber())
                .category(category)
                .supplier(supplier)
                .build();

        Medicine savedMedicine = medicineRepository.save(medicine);

        Inventory inventory = Inventory.builder()
                .medicine(savedMedicine)
                .quantity(request.getInitialQuantity() != null ? request.getInitialQuantity() : 0)
                .reorderLevel(request.getReorderLevel() != null ? request.getReorderLevel() : 10)
                .maxQuantity(request.getMaxQuantity() != null ? request.getMaxQuantity() : 100)
                .locationRack(request.getLocationRack())
                .build();

        inventoryRepository.save(inventory);
        savedMedicine.setInventory(inventory);

        if (request.getInitialQuantity() != null && request.getInitialQuantity() > 0) {
            stockMovementService.logMovement(savedMedicine.getId(), request.getBatchNumber(), MovementType.IN, request.getInitialQuantity(), null);
        }

        return mapToResponse(savedMedicine);
    }

    @Override
    @Transactional
    public MedicineResponse updateMedicine(Long id, MedicineRequest request) {
        Medicine medicine = medicineRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found with id: " + id));

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found with id: " + request.getCategoryId()));
            medicine.setCategory(category);
        }

        if (request.getSupplierId() != null) {
            Supplier supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Supplier not found with id: " + request.getSupplierId()));
            medicine.setSupplier(supplier);
        }

        medicine.setName(request.getName());
        medicine.setGenericName(request.getGenericName());
        medicine.setManufacturer(request.getManufacturer());

        if (request.getUnitPrice() != null) {
            medicine.setUnitPrice(request.getUnitPrice());
        }
        if (request.getSellingPrice() != null) {
            medicine.setSellingPrice(request.getSellingPrice());
            medicine.setPrice(request.getSellingPrice());
        } else if (request.getPrice() != null) {
            medicine.setSellingPrice(request.getPrice());
            medicine.setPrice(request.getPrice());
        }

        medicine.setExpiryDate(request.getExpiryDate());
        medicine.setBatchNumber(request.getBatchNumber());

        return mapToResponse(medicineRepository.save(medicine));
    }

    @Override
    @Transactional
    public void deleteMedicine(Long id) {
        if (!medicineRepository.existsById(id)) {
            throw new ResourceNotFoundException("Medicine not found with id: " + id);
        }

        // Clean up FK-dependent records: stock_movements → batches → medicine
        // (inventory is auto-cascaded via CascadeType.ALL on Medicine entity)
        List<Batch> batches = batchRepository.findByMedicineId(id);
        for (Batch batch : batches) {
            List<StockMovement> movements = stockMovementRepository.findByBatchMedicineIdOrderByDateDesc(id);
            stockMovementRepository.deleteAll(movements);
        }
        batchRepository.deleteAll(batches);

        medicineRepository.deleteById(id);
    }

    @Override
    @Transactional
    public void bulkUpdateSupplierSellingPrice(Long supplierId, BigDecimal markupPercentage, BigDecimal fixedSellingPrice) {
        if (!supplierRepository.existsById(supplierId)) {
            throw new ResourceNotFoundException("Supplier not found with id: " + supplierId);
        }

        List<Medicine> medicines = medicineRepository.findBySupplierId(supplierId);
        for (Medicine med : medicines) {
            BigDecimal newSellingPrice = null;
            if (fixedSellingPrice != null && fixedSellingPrice.compareTo(BigDecimal.ZERO) > 0) {
                newSellingPrice = fixedSellingPrice;
            } else if (markupPercentage != null) {
                BigDecimal baseCost = med.getUnitPrice();
                if (baseCost == null && med.getCode() != null) {
                    baseCost = supplierMedicineRepository
                            .findBySupplierIdAndCode(supplierId, med.getCode())
                            .map(SupplierMedicine::getPrice)
                            .orElse(med.getPrice());
                }
                if (baseCost == null) {
                    baseCost = med.getPrice();
                }

                if (baseCost != null) {
                    BigDecimal multiplier = BigDecimal.ONE.add(markupPercentage.divide(BigDecimal.valueOf(100), 4, java.math.RoundingMode.HALF_UP));
                    newSellingPrice = baseCost.multiply(multiplier).setScale(2, java.math.RoundingMode.HALF_UP);
                }
            }

            if (newSellingPrice != null) {
                med.setSellingPrice(newSellingPrice);
                med.setPrice(newSellingPrice);
                medicineRepository.save(med);
            }
        }
    }

    private List<StockStatus> calculateStockStatus(Medicine medicine) {
        List<StockStatus> statuses = new ArrayList<>();
        Integer quantity = medicine.getInventory() != null ? medicine.getInventory().getQuantity() : 0;
        Integer reorderLevel = medicine.getInventory() != null ? medicine.getInventory().getReorderLevel() : 0;
        LocalDate expiryDate = medicine.getExpiryDate();
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryLimit = today.plusDays(nearExpiryDays);

        if (expiryDate != null) {
            if (expiryDate.isBefore(today)) {
                statuses.add(StockStatus.EXPIRED);
            } else if (!expiryDate.isAfter(nearExpiryLimit)) {
                if (quantity != null && quantity > 0) {
                    statuses.add(StockStatus.NEAR_EXPIRY);
                }
            }
        }
        if (quantity == 0) {
            statuses.add(StockStatus.OUT_OF_STOCK);
        }
        if (quantity <= reorderLevel) {
            statuses.add(StockStatus.LOW_STOCK);
        } else {
            statuses.add(StockStatus.AVAILABLE);
        }

        if (statuses.isEmpty()) {
            statuses.add(StockStatus.AVAILABLE);
        }
        return statuses;
    }

    private java.util.Map<String, SupplierMedicine> buildSupplierMedicineMap() {
        List<SupplierMedicine> allSm = supplierMedicineRepository.findAll();
        return allSm.stream()
                .filter(sm -> sm.getSupplier() != null && sm.getSupplier().getId() != null && sm.getCode() != null)
                .collect(Collectors.toMap(
                        sm -> sm.getSupplier().getId() + ":" + sm.getCode(),
                        sm -> sm,
                        (existing, replacement) -> existing
                ));
    }

    private MedicineResponse mapToResponse(Medicine medicine) {
        return mapToResponseWithMap(medicine, null);
    }

    private MedicineResponse mapToResponseWithMap(Medicine medicine, java.util.Map<String, SupplierMedicine> supplierMedMap) {
        CategoryDto categoryDto = medicine.getCategory() != null ?
                CategoryDto.builder()
                        .id(medicine.getCategory().getId())
                        .name(medicine.getCategory().getName())
                        .description(medicine.getCategory().getDescription())
                        .build() : null;

        SupplierDto supplierDto = medicine.getSupplier() != null ?
                SupplierDto.builder()
                        .id(medicine.getSupplier().getId())
                        .name(medicine.getSupplier().getName())
                        .contactPerson(medicine.getSupplier().getContactPerson())
                        .email(medicine.getSupplier().getEmail())
                        .phone(medicine.getSupplier().getPhone())
                        .address(medicine.getSupplier().getAddress())
                        .build() : null;

        Integer stock = medicine.getInventory() != null ? medicine.getInventory().getQuantity() : 0;
        Integer reorder = medicine.getInventory() != null ? medicine.getInventory().getReorderLevel() : 0;

        Integer supplierQty = 0;
        BigDecimal supplierBuyingPrice = null;
        if (medicine.getSupplier() != null && medicine.getCode() != null) {
            SupplierMedicine sm = null;
            if (supplierMedMap != null) {
                sm = supplierMedMap.get(medicine.getSupplier().getId() + ":" + medicine.getCode());
            } else {
                Optional<SupplierMedicine> smOpt = supplierMedicineRepository
                        .findBySupplierIdAndCode(medicine.getSupplier().getId(), medicine.getCode());
                if (smOpt.isPresent()) {
                    sm = smOpt.get();
                }
            }
            if (sm != null) {
                supplierQty = sm.getAvailableQuantity() != null ? sm.getAvailableQuantity() : 0;
                supplierBuyingPrice = sm.getPrice();
            }
        }

        BigDecimal effectiveUnitPrice = medicine.getUnitPrice() != null ? medicine.getUnitPrice() : supplierBuyingPrice;
        BigDecimal effectiveSellingPrice = medicine.getSellingPrice() != null ? medicine.getSellingPrice() : medicine.getPrice();

        return MedicineResponse.builder()
                .id(medicine.getId())
                .name(medicine.getName())
                .code(medicine.getCode())
                .genericName(medicine.getGenericName())
                .manufacturer(medicine.getManufacturer())
                .unitPrice(effectiveUnitPrice)
                .sellingPrice(effectiveSellingPrice)
                .price(effectiveSellingPrice)
                .expiryDate(medicine.getExpiryDate())
                .batchNumber(medicine.getBatchNumber())
                .category(categoryDto)
                .supplier(supplierDto)
                .currentStock(stock)
                .reorderLevel(reorder)
                .supplierAvailableQuantity(supplierQty)
                .stockStatus(calculateStockStatus(medicine))
                .build();
    }

    private List<StockStatus> calculateSupplierStockStatus(SupplierMedicine sm, Integer quantity) {
        List<StockStatus> statuses = new ArrayList<>();
        Integer reorderLevel = 10;
        LocalDate expiryDate = sm.getExpiryDate();
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryLimit = today.plusDays(nearExpiryDays);

        if (expiryDate != null) {
            if (expiryDate.isBefore(today)) {
                statuses.add(StockStatus.EXPIRED);
            } else if (!expiryDate.isAfter(nearExpiryLimit)) {
                if (quantity != null && quantity > 0) {
                    statuses.add(StockStatus.NEAR_EXPIRY);
                }
            }
        }
        if (quantity == null || quantity == 0) {
            statuses.add(StockStatus.OUT_OF_STOCK);
        }
        if (quantity != null && quantity <= reorderLevel) {
            statuses.add(StockStatus.LOW_STOCK);
        } else {
            statuses.add(StockStatus.AVAILABLE);
        }

        if (statuses.isEmpty()) {
            statuses.add(StockStatus.AVAILABLE);
        }
        return statuses;
    }

    private MedicineResponse mapSupplierMedicineToResponse(SupplierMedicine sm) {
        CategoryDto categoryDto = sm.getCategory() != null ?
                CategoryDto.builder()
                        .id(sm.getCategory().getId())
                        .name(sm.getCategory().getName())
                        .description(sm.getCategory().getDescription())
                        .build() : null;

        SupplierDto supplierDto = sm.getSupplier() != null ?
                SupplierDto.builder()
                        .id(sm.getSupplier().getId())
                        .name(sm.getSupplier().getName())
                        .contactPerson(sm.getSupplier().getContactPerson())
                        .email(sm.getSupplier().getEmail())
                        .phone(sm.getSupplier().getPhone())
                        .address(sm.getSupplier().getAddress())
                        .build() : null;

        Integer supplierQty = sm.getAvailableQuantity() != null ? sm.getAvailableQuantity() : 0;

        Long medicineId = sm.getId(); // default to supplier_medicine ID
        Integer adminStock = 0;
        Integer reorderLevel = 10;
        if (sm.getCode() != null) {
            Optional<Medicine> medOpt = medicineRepository.findByCode(sm.getCode());
            if (!medOpt.isPresent() && sm.getName() != null) {
                List<Medicine> matches = medicineRepository.findByNameIgnoreCaseAndGenericNameIgnoreCaseAndManufacturerIgnoreCase(
                        sm.getName().trim(),
                        sm.getGenericName() != null ? sm.getGenericName().trim() : "",
                        sm.getManufacturer() != null ? sm.getManufacturer().trim() : ""
                );
                if (!matches.isEmpty()) {
                    medOpt = Optional.of(matches.get(0));
                }
            }
            if (medOpt.isPresent()) {
                Medicine med = medOpt.get();
                medicineId = med.getId();
                if (med.getInventory() != null) {
                    adminStock = med.getInventory().getQuantity() != null ? med.getInventory().getQuantity() : 0;
                    reorderLevel = med.getInventory().getReorderLevel() != null ? med.getInventory().getReorderLevel() : 10;
                }
                if (categoryDto == null && med.getCategory() != null) {
                    categoryDto = CategoryDto.builder()
                            .id(med.getCategory().getId())
                            .name(med.getCategory().getName())
                            .description(med.getCategory().getDescription())
                            .build();
                }
            }
        }

        return MedicineResponse.builder()
                .id(sm.getId())
                .name(sm.getName())
                .code(sm.getCode())
                .genericName(sm.getGenericName())
                .manufacturer(sm.getManufacturer())
                .price(sm.getPrice())
                .expiryDate(sm.getExpiryDate())
                .batchNumber(sm.getBatchNumber())
                .category(categoryDto)
                .supplier(supplierDto)
                .currentStock(adminStock)
                .reorderLevel(reorderLevel)
                .supplierAvailableQuantity(supplierQty)
                .stockStatus(calculateStockStatusValues(adminStock, reorderLevel, sm.getExpiryDate()))
                .build();
    }

    private List<StockStatus> calculateStockStatusValues(Integer quantity, Integer reorderLevel, LocalDate expiryDate) {
        List<StockStatus> statuses = new ArrayList<>();
        LocalDate today = LocalDate.now();
        LocalDate nearExpiryLimit = today.plusDays(nearExpiryDays);

        if (expiryDate != null) {
            if (expiryDate.isBefore(today)) {
                statuses.add(StockStatus.EXPIRED);
            } else if (!expiryDate.isAfter(nearExpiryLimit)) {
                if (quantity != null && quantity > 0) {
                    statuses.add(StockStatus.NEAR_EXPIRY);
                }
            }
        }
        if (quantity == null || quantity == 0) {
            statuses.add(StockStatus.OUT_OF_STOCK);
        } else if (quantity <= reorderLevel) {
            statuses.add(StockStatus.LOW_STOCK);
        } else {
            statuses.add(StockStatus.AVAILABLE);
        }

        if (statuses.isEmpty()) {
            statuses.add(StockStatus.AVAILABLE);
        }
        return statuses;
    }

    private Long getCurrentSupplierId() {
        org.springframework.security.core.Authentication authentication = 
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            String username = authentication.getName();
            java.util.Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                if (user.getRoles().stream().anyMatch(r -> r.getName() == ERole.ROLE_SUPPLIER)) {
                    Supplier supplier = resolveSupplierForUser(user);
                    if (supplier != null) {
                        return supplier.getId();
                    }
                }
            }
        }
        return null;
    }

    private Supplier resolveSupplierForUser(User user) {
        Optional<Supplier> supplierOpt = supplierRepository.findByUserId(user.getId());
        if (supplierOpt.isPresent()) {
            return supplierOpt.get();
        }

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            Optional<Supplier> byEmail = supplierRepository.findByEmail(user.getEmail());
            if (byEmail.isPresent()) {
                Supplier s = byEmail.get();
                s.setUser(user);
                return supplierRepository.save(s);
            }
        }

        String name = user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : user.getUsername();
        List<Supplier> byName = supplierRepository.findByNameContainingIgnoreCase(name);
        if (!byName.isEmpty()) {
            Supplier s = byName.get(0);
            s.setUser(user);
            return supplierRepository.save(s);
        }

        Supplier newSupplier = Supplier.builder()
                .name(name)
                .contactPerson(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .user(user)
                .build();
        return supplierRepository.save(newSupplier);
    }
}
