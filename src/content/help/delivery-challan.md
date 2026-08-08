---
title: "Delivery Challan Management & Logistics"
description: "A comprehensive guide to issuing, tracking, and completing Delivery Challans (DC) for material shipments to project sites."
category: "Inventory"
lastUpdated: "2026-07-22"
---

A Delivery Challan (DC) is the core transaction document used to record the dispatch of physical goods from your warehouses to project locations or client sites. It serves as both a transit permit and a stock-movement record.

---

## 1. Types of Delivery Challans

Perfect ERP supports two types of Delivery Challans depending on your billing structure:

### Billable Delivery Challans
Used when goods are shipped to a client project and will eventually be billed via a sales invoice. 
- Dispatches reduce your warehouse stock levels.
- Pre-fills item pricing, discount categories, and GST rates from linked quotations or sales orders.
- Directly updates the project’s **Material Consumption Summary** as "Received Quantity".

### Non-Billable Delivery Challans (NB-DC)
Used for transporting tools, machinery, internal equipment, or demo samples that will eventually return to the warehouse.
- Tracks temporary material usage at project sites.
- Does not affect commercial invoicing or billing lines.

---

## 2. Creating a Delivery Challan

Follow these steps to generate a new shipment record:

1. Navigate to **Delivery challan > Create DC** in the sidebar.
2. Select the **Project** (required) and target **Client** (pre-filled from the project).
3. Set the **Challan Date** and select the **Source Warehouse** supplying the materials.
4. Input logistics and transit details:
   - **Vehicle Number** (e.g. `KA-01-ME-1234`)
   - **Driver Name** and **Phone Number**
   - **E-way Bill Number** (for high-value interstate transits)
5. Load items into the grid:
   - Click **Load from BOQ** to auto-populate materials planned for the project.
   - Click **Add Multiple Items** to search and batch-select items.
   - Input the **Quantity** being dispatched. The system checks warehouse stock levels and displays alerts if quantities exceed current available stock.
6. Click **Save Draft** to store local progress, or **Complete Challan** to authorize.

> **Note:** Once marked as **Completed**, the challan becomes locked, warehouse inventory is decremented, and the project consumption report is refreshed.

---

## 3. Stock Impact & Flow

```
[Warehouse Stock] ──(Create DC)──> [Project Site (Received)] ──(Material Return)──> [Restocked in Warehouse]
```

When a DC transitions to **Completed**:
- **Warehouse Inventory**: The `current_stock` in the source warehouse is decremented by the challan line quantities.
- **Project Site**: The quantities are logged as *Received Quantity* in the project’s material registry.
- **Consumption math**:
  $$\text{Actual Site Quantity} = \text{Received Qty} - \text{Used Qty} - \text{Returned Qty}$$

---

## 4. Material Returns & Reconciliation

Leftover or surplus materials delivered to a site via Delivery Challans can be safely returned using the **Material Returns** module:
1. Go to **Delivery challan > Material returns** and click **New Return**.
2. Select the Project.
3. Select the returned items and allocate them back to the original Delivery Challan document.
4. Completing a return restores the quantities to your default warehouse stock and reduces the project’s actual site quantities.

---

## 5. Templates & Export

Under **Settings > Print Templates**, you can configure layouts for your challan PDF:
- **Classic**: Unified master header grid with clear boxes for transit data.
- **Modern**: Clean, text-focused table with dark-accent headers.
- Click **Download PDF** from any challan's detail page to generate a print-ready, high-resolution copy.
