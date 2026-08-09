-- 0012_kb_seed.sql — migrate the four existing help articles into the KB
-- Generated from src/content/help/*.md (markdown → safe HTML). Idempotent.

insert into public.kb_articles (
  page_id, kind, title, summary, content_md, content_html,
  category_id, reading_time_min, keywords, status, created_at, updated_at
)
select p.id,
'user_guide'::public.kb_kind,
  'Creating a Professional Quotation',
  'A complete step-by-step guide to generating GST-compliant quotes for your clients.',
  'Generating a proposal is the first critical step in your project workflow. Perfect ERP makes this fast, structured, and compliant.

## How to Create a Quote

1. Log into your dashboard and navigate to **Quotations** in the sidebar.
2. Click **Create Quotation** at the top right.
3. Select an existing client or input details for a new client.
4. Add line items from your preset material catalog or define custom work scopes:
   - Input the unit rate, quantity, and apply specific GST rates (e.g. 18% HSN/SAC).
   - Apply any client-specific discounts.
5. Review subtotal, taxes, and final values.
6. Click **Generate & Save** to create the PDF.

## Document Templates

Under **Settings > Document Templates**, you can choose between:
- **Classic**: The standard professional invoice layout.
- **Modern**: Clean, minimal visual layout with grid alignment.
- **Zoho-style**: Traditional invoice format with customer terms.',
  '<p>Generating a proposal is the first critical step in your project workflow. Perfect ERP makes this fast, structured, and compliant.</p>
<h2>How to Create a Quote</h2>
<ol>
<li>Log into your dashboard and navigate to <strong>Quotations</strong> in the sidebar.</li>
<li>Click <strong>Create Quotation</strong> at the top right.</li>
<li>Select an existing client or input details for a new client.</li>
<li>Add line items from your preset material catalog or define custom work scopes:</li>
</ol>
<ul>
<li>Input the unit rate, quantity, and apply specific GST rates (e.g. 18% HSN/SAC).</li>
<li>Apply any client-specific discounts.</li>
</ul>
<ol>
<li>Review subtotal, taxes, and final values.</li>
<li>Click <strong>Generate &amp; Save</strong> to create the PDF.</li>
</ol>
<h2>Document Templates</h2>
<p>Under <strong>Settings &gt; Document Templates</strong>, you can choose between:</p>
<ul>
<li><strong>Classic</strong>: The standard professional invoice layout.</li>
<li><strong>Modern</strong>: Clean, minimal visual layout with grid alignment.</li>
<li><strong>Zoho-style</strong>: Traditional invoice format with customer terms.</li>
</ul>',
  (select id from public.kb_categories where slug = 'sales-billing'),
  1,
  '{}'::text[],
  'published'::public.content_status, now(), now()
from public.pages p
join (values ('/help/create-quotation')) as v(slug) on v.slug = p.slug
where not exists (select 1 from public.kb_articles k where k.page_id = p.id)
  union all
  select p.id,
  'user_guide'::public.kb_kind,
  'Inventory Transfers Between Warehouses',
  'How to safely move materials between different storage locations and sites without breaking stock balances.',
  'Managing materials across multiple locations is critical. Perfect ERP provides a clean mechanism to handle transfers.

## Transferring Stock

1. Open **Inventory > Stock Transfer** on the dashboard.
2. Click **New Transfer**.
3. Select the **Source Warehouse** (where the materials are currently stored).
4. Select the **Destination Warehouse** or specific project site.
5. Search and select the items to transfer:
   - Enter the transfer quantity.
   - The system automatically checks if the source warehouse has sufficient stock.
6. Click **Confirm Transfer**.

## Stock Reconciliation

After a transfer reaches its destination, the site engineer should verify the quantities and mark the transfer as **Received** to reconcile stock logs.',
  '<p>Managing materials across multiple locations is critical. Perfect ERP provides a clean mechanism to handle transfers.</p>
<h2>Transferring Stock</h2>
<ol>
<li>Open <strong>Inventory &gt; Stock Transfer</strong> on the dashboard.</li>
<li>Click <strong>New Transfer</strong>.</li>
<li>Select the <strong>Source Warehouse</strong> (where the materials are currently stored).</li>
<li>Select the <strong>Destination Warehouse</strong> or specific project site.</li>
<li>Search and select the items to transfer:</li>
</ol>
<ul>
<li>Enter the transfer quantity.</li>
<li>The system automatically checks if the source warehouse has sufficient stock.</li>
</ul>
<ol>
<li>Click <strong>Confirm Transfer</strong>.</li>
</ol>
<h2>Stock Reconciliation</h2>
<p>After a transfer reaches its destination, the site engineer should verify the quantities and mark the transfer as <strong>Received</strong> to reconcile stock logs.</p>',
  (select id from public.kb_categories where slug = 'inventory-operations'),
  1,
  '{}'::text[],
  'published'::public.content_status, now(), now()
from public.pages p
join (values ('/help/inventory-transfer')) as v(slug) on v.slug = p.slug
where not exists (select 1 from public.kb_articles k where k.page_id = p.id)
  union all
  select p.id,
  'user_guide'::public.kb_kind,
  'Project Milestone Billing & Invoicing',
  'Streamline project cash flows by raising milestone-based client invoices and tracking payments.',
  'Milestone billing allows your company to charge clients as the work proceeds, rather than waiting for full execution completion.

## Raising a Milestone Invoice

1. Open your project dashboard under **Projects > Active Projects**.
2. Select the target project.
3. Click the **Billing** tab and select **Create Milestone Invoice**.
4. Link the invoice to a specific completed milestone (e.g. "Foundation Complete").
5. Input the amount to invoice (the system will check this against your project budget limits).
6. Verify and apply appropriate GST tax rules.
7. Click **Issue Invoice**.

The invoice will automatically show up under the client''s outstanding ledger balance.',
  '<p>Milestone billing allows your company to charge clients as the work proceeds, rather than waiting for full execution completion.</p>
<h2>Raising a Milestone Invoice</h2>
<ol>
<li>Open your project dashboard under <strong>Projects &gt; Active Projects</strong>.</li>
<li>Select the target project.</li>
<li>Click the <strong>Billing</strong> tab and select <strong>Create Milestone Invoice</strong>.</li>
<li>Link the invoice to a specific completed milestone (e.g. &quot;Foundation Complete&quot;).</li>
<li>Input the amount to invoice (the system will check this against your project budget limits).</li>
<li>Verify and apply appropriate GST tax rules.</li>
<li>Click <strong>Issue Invoice</strong>.</li>
</ol>
<p>The invoice will automatically show up under the client&#x27;s outstanding ledger balance.</p>',
  (select id from public.kb_categories where slug = 'sales-billing'),
  1,
  '{}'::text[],
  'published'::public.content_status, now(), now()
from public.pages p
join (values ('/help/project-billing')) as v(slug) on v.slug = p.slug
where not exists (select 1 from public.kb_articles k where k.page_id = p.id)
  union all
  select p.id,
  'user_guide'::public.kb_kind,
  'Site Visit Management & Field Operations',
  'End-to-end guide for planning, executing, and closing site visits with check-in/out, measurements, testing, sign-off, and follow-ups.',
  'Site visits are the bridge between your office and the field. Every visit — whether a survey, installation, inspection, or handover — generates artifacts that flow into projects, client communication, approvals, and financial records.

## The Site Visit Lifecycle

A site visit passes through six stages. This guide walks each one.

```
Schedule → Check In → Report → Check Out → Approve → Follow Up
```

## 1. Scheduling a Site Visit

Navigate to **Site Visits** in the sidebar under *Client and Field*. You can also create a visit directly from a Project or a Client Communication.

### From the Site Visits page

1. Click **New Site Visit**.
2. Select the **Client** (required) and optionally the **Project** and **Lead**.
3. Set the **Visit Date** and **Visit Time**.
4. Choose a **Purpose** — select from your saved list or type a new one.
5. Fill in the **Site Contact** details: person name, phone, and designation.
6. Set the **Visit Type**: Survey, Installation, Maintenance, Inspection, Repair, Handover, Consultation, or Other.
7. Set **Priority**: Standard, Urgent, or Emergency.
8. Add the **Site Address** and optional **Google Maps location link**.
9. Toggle **Chargeable** if the visit will be billed to the client.
10. Click **Create Visit** to schedule it (status: `Scheduled`), or **Save as Draft** to finalize later.

### From a Project

Open any project and click the **Schedule Site Visit** shortcut — it pre-fills the client and project IDs so you don''t have to search.

### From a Client Communication

When logging a client interaction, toggle **Require a Site Visit** to create a linked visit with the correct client and date in one step.

## 2. Viewing Visits

The Site Visits page has three views, each for a different purpose:

### Table View (default)

A sortable, filterable table showing every visit. Use the column visibility menu to show or hide fields. Use the search bar and status/project/engineer filters to narrow down.

### Calendar View

A monthly grid with coloured pills per day. Each pill represents a visit, colour-coded by status. Click any day to schedule a new visit on that date; click an existing pill to view its details.

### Updates View

A compact table showing dates, clients, purposes, in/out times, discussion notes, measurements, and next actions — optimised for reviewing what happened on site.

## 3. Check-In (Arrival)

When the engineer arrives at site:

1. Open the visit from the list or calendar.
2. Click **Check In**.
3. Grant location permission when prompted — the system captures GPS coordinates.
4. The status changes to `In Progress` and the check-in time is recorded.

> Check-in is only available on or after the scheduled visit date.

## 4. Reporting During the Visit

While on site, the engineer can record:

- **Discussion Points** — what was discussed with the client or site team
- **Measurements** — site measurements and readings
- **Equipment Used** — tools and instruments deployed
- **Weather Conditions** — relevant for outdoor work
- **Safety Hazards** — any hazards observed
- **Recommendations** — suggestions for the client or internal team

## 5. Check-Out (Completion)

Check-out is the most feature-rich step. It collects everything needed to turn a site visit into a formal record.

### Visit Checklist

Dynamic questions based on the visit type:
- **Maintenance**: Pressure levels, lubrication, filter status, leakages
- **Inspection**: Structural integrity, electrical connections, safety signage
- **Default**: Task completion, site cleanliness, safety briefings

### Joint Measurement Sheet (JMS)

Optional — used when a subcontractor is involved:
1. Select the **Subcontractor**.
2. Add measurement line items: description, unit, quantity, rate.
3. The sheet is stored and visible from both the site visit and the subcontractor record.

### Testing & Commissioning (T&C) Protocol

Available for Inspection, Testing, or Audit visit types:
1. Select the **Equipment** from the project equipment list.
2. Enter the **Client Witness Representative** name.
3. Choose a **Test Type**: Hydrostatic Pressure Test, Electrical Insulation Megger, Air Velocity Test, or Custom.
4. Add parameters with required values, actual readings, and pass/fail/pending status.

### Site Observation

Optional insights logged during the visit:
1. Choose a **Category**: Improvement Opportunity, Best Practice, Client Feedback, Coordination Issue, Safety Observation, or Cost Saving Idea.
2. Add a **Title** — use the voice dictation button to speak it.
3. Quick suggestions are available for common MEP observations.

### Client Sign-Off

1. Enter the client representative''s **Name** and **Designation**.
2. Capture their **Digital Signature** using the on-screen drawing canvas.
3. The signed record is stored immutably.

### Submitting

Click **Complete Visit** to finalise. The system:
- Saves checklist responses, JMS items, T&C readings, observations, and the signature
- Records GPS check-out coordinates
- Sets status to `Completed`
- Logs the event in the activity trail

## 6. Approval Workflow

If your organisation requires approval for site visits (configured in **Settings > Approval Settings**), a completed visit can be submitted for approval:

1. The visit status changes to `Pending Approval`.
2. Managers see it in their **Approvals** dashboard.
3. On approval, the visit is confirmed. On rejection, it''s returned with status `Rejected`.

## 7. Follow-Ups and Next Actions

Every completed visit can generate a **next step** and **follow-up date**:

1. The visit appears on the Dashboard''s **Next Actions** widget.
2. Team members acknowledge actions to remove them from their queue.
3. The Follow-Up Centre shows overdue and upcoming site visit follow-ups alongside quotations, invoices, and other items in a single priority-sorted list.

## 8. Exporting and Calendar Integration

### PDF Report

Click **Download PDF** from the visit detail view to generate a professional A4 report with:
- Scheduling & client details
- Operational report (measurements, discussion, equipment)
- Expense tracking
- Sign-off section

### Google Calendar

Click **Add to Google Calendar** to open a pre-filled Google Calendar event with the visit title, date, location, and notes.

### .ics File

Click **Download .ics** to get a calendar file you can import into Outlook, Apple Calendar, or any calendar app.

## 9. Deletion and Activity Log

- **Single delete**: open a visit and click Delete with confirmation.
- **Batch delete**: select multiple visits from the table and click the delete icon.
- Every creation, draft save, update, and deletion is logged in the **Activity Log** — accessible per-visit and globally.

## Related Modules

Site visits connect to these areas of the system:

| Module | Relationship |
|--------|-------------|
| **Projects** | Visits are linked to projects; shortcuts exist to schedule from the project view |
| **Clients** | Every visit is tied to a client record |
| **Leads** | Visits can optionally reference a lead |
| **Client Communication** | Communications can create linked site visits |
| **Subcontractors** | JMS measurements tie to subcontractor records |
| **Project Equipment** | T&C protocols reference equipment on the project |
| **Project Insights** | Observations feed into the project insights timeline |
| **Approvals** | Visit approval integrates with the workflow engine |
| **Dashboard** | Pending follow-ups appear in next actions |
| **Follow-Up Centre** | Overdue and upcoming visits appear in the unified queue |',
  '<p>Site visits are the bridge between your office and the field. Every visit — whether a survey, installation, inspection, or handover — generates artifacts that flow into projects, client communication, approvals, and financial records.</p>
<h2>The Site Visit Lifecycle</h2>
<p>A site visit passes through six stages. This guide walks each one.</p>
<pre><code>Schedule → Check In → Report → Check Out → Approve → Follow Up</code></pre>
<h2>1. Scheduling a Site Visit</h2>
<p>Navigate to <strong>Site Visits</strong> in the sidebar under <em>Client and Field</em>. You can also create a visit directly from a Project or a Client Communication.</p>
<h3>From the Site Visits page</h3>
<ol>
<li>Click <strong>New Site Visit</strong>.</li>
<li>Select the <strong>Client</strong> (required) and optionally the <strong>Project</strong> and <strong>Lead</strong>.</li>
<li>Set the <strong>Visit Date</strong> and <strong>Visit Time</strong>.</li>
<li>Choose a <strong>Purpose</strong> — select from your saved list or type a new one.</li>
<li>Fill in the <strong>Site Contact</strong> details: person name, phone, and designation.</li>
<li>Set the <strong>Visit Type</strong>: Survey, Installation, Maintenance, Inspection, Repair, Handover, Consultation, or Other.</li>
<li>Set <strong>Priority</strong>: Standard, Urgent, or Emergency.</li>
<li>Add the <strong>Site Address</strong> and optional <strong>Google Maps location link</strong>.</li>
<li>Toggle <strong>Chargeable</strong> if the visit will be billed to the client.</li>
<li>Click <strong>Create Visit</strong> to schedule it (status: <code>Scheduled</code>), or <strong>Save as Draft</strong> to finalize later.</li>
</ol>
<h3>From a Project</h3>
<p>Open any project and click the <strong>Schedule Site Visit</strong> shortcut — it pre-fills the client and project IDs so you don&#x27;t have to search.</p>
<h3>From a Client Communication</h3>
<p>When logging a client interaction, toggle <strong>Require a Site Visit</strong> to create a linked visit with the correct client and date in one step.</p>
<h2>2. Viewing Visits</h2>
<p>The Site Visits page has three views, each for a different purpose:</p>
<h3>Table View (default)</h3>
<p>A sortable, filterable table showing every visit. Use the column visibility menu to show or hide fields. Use the search bar and status/project/engineer filters to narrow down.</p>
<h3>Calendar View</h3>
<p>A monthly grid with coloured pills per day. Each pill represents a visit, colour-coded by status. Click any day to schedule a new visit on that date; click an existing pill to view its details.</p>
<h3>Updates View</h3>
<p>A compact table showing dates, clients, purposes, in/out times, discussion notes, measurements, and next actions — optimised for reviewing what happened on site.</p>
<h2>3. Check-In (Arrival)</h2>
<p>When the engineer arrives at site:</p>
<ol>
<li>Open the visit from the list or calendar.</li>
<li>Click <strong>Check In</strong>.</li>
<li>Grant location permission when prompted — the system captures GPS coordinates.</li>
<li>The status changes to <code>In Progress</code> and the check-in time is recorded.</li>
</ol>
<blockquote>Check-in is only available on or after the scheduled visit date.</blockquote>
<h2>4. Reporting During the Visit</h2>
<p>While on site, the engineer can record:</p>
<ul>
<li><strong>Discussion Points</strong> — what was discussed with the client or site team</li>
<li><strong>Measurements</strong> — site measurements and readings</li>
<li><strong>Equipment Used</strong> — tools and instruments deployed</li>
<li><strong>Weather Conditions</strong> — relevant for outdoor work</li>
<li><strong>Safety Hazards</strong> — any hazards observed</li>
<li><strong>Recommendations</strong> — suggestions for the client or internal team</li>
</ul>
<h2>5. Check-Out (Completion)</h2>
<p>Check-out is the most feature-rich step. It collects everything needed to turn a site visit into a formal record.</p>
<h3>Visit Checklist</h3>
<p>Dynamic questions based on the visit type:</p>
<ul>
<li><strong>Maintenance</strong>: Pressure levels, lubrication, filter status, leakages</li>
<li><strong>Inspection</strong>: Structural integrity, electrical connections, safety signage</li>
<li><strong>Default</strong>: Task completion, site cleanliness, safety briefings</li>
</ul>
<h3>Joint Measurement Sheet (JMS)</h3>
<p>Optional — used when a subcontractor is involved:</p>
<ol>
<li>Select the <strong>Subcontractor</strong>.</li>
<li>Add measurement line items: description, unit, quantity, rate.</li>
<li>The sheet is stored and visible from both the site visit and the subcontractor record.</li>
</ol>
<h3>Testing &amp; Commissioning (T&amp;C) Protocol</h3>
<p>Available for Inspection, Testing, or Audit visit types:</p>
<ol>
<li>Select the <strong>Equipment</strong> from the project equipment list.</li>
<li>Enter the <strong>Client Witness Representative</strong> name.</li>
<li>Choose a <strong>Test Type</strong>: Hydrostatic Pressure Test, Electrical Insulation Megger, Air Velocity Test, or Custom.</li>
<li>Add parameters with required values, actual readings, and pass/fail/pending status.</li>
</ol>
<h3>Site Observation</h3>
<p>Optional insights logged during the visit:</p>
<ol>
<li>Choose a <strong>Category</strong>: Improvement Opportunity, Best Practice, Client Feedback, Coordination Issue, Safety Observation, or Cost Saving Idea.</li>
<li>Add a <strong>Title</strong> — use the voice dictation button to speak it.</li>
<li>Quick suggestions are available for common MEP observations.</li>
</ol>
<h3>Client Sign-Off</h3>
<ol>
<li>Enter the client representative&#x27;s <strong>Name</strong> and <strong>Designation</strong>.</li>
<li>Capture their <strong>Digital Signature</strong> using the on-screen drawing canvas.</li>
<li>The signed record is stored immutably.</li>
</ol>
<h3>Submitting</h3>
<p>Click <strong>Complete Visit</strong> to finalise. The system:</p>
<ul>
<li>Saves checklist responses, JMS items, T&amp;C readings, observations, and the signature</li>
<li>Records GPS check-out coordinates</li>
<li>Sets status to <code>Completed</code></li>
<li>Logs the event in the activity trail</li>
</ul>
<h2>6. Approval Workflow</h2>
<p>If your organisation requires approval for site visits (configured in <strong>Settings &gt; Approval Settings</strong>), a completed visit can be submitted for approval:</p>
<ol>
<li>The visit status changes to <code>Pending Approval</code>.</li>
<li>Managers see it in their <strong>Approvals</strong> dashboard.</li>
<li>On approval, the visit is confirmed. On rejection, it&#x27;s returned with status <code>Rejected</code>.</li>
</ol>
<h2>7. Follow-Ups and Next Actions</h2>
<p>Every completed visit can generate a <strong>next step</strong> and <strong>follow-up date</strong>:</p>
<ol>
<li>The visit appears on the Dashboard&#x27;s <strong>Next Actions</strong> widget.</li>
<li>Team members acknowledge actions to remove them from their queue.</li>
<li>The Follow-Up Centre shows overdue and upcoming site visit follow-ups alongside quotations, invoices, and other items in a single priority-sorted list.</li>
</ol>
<h2>8. Exporting and Calendar Integration</h2>
<h3>PDF Report</h3>
<p>Click <strong>Download PDF</strong> from the visit detail view to generate a professional A4 report with:</p>
<ul>
<li>Scheduling &amp; client details</li>
<li>Operational report (measurements, discussion, equipment)</li>
<li>Expense tracking</li>
<li>Sign-off section</li>
</ul>
<h3>Google Calendar</h3>
<p>Click <strong>Add to Google Calendar</strong> to open a pre-filled Google Calendar event with the visit title, date, location, and notes.</p>
<h3>.ics File</h3>
<p>Click <strong>Download .ics</strong> to get a calendar file you can import into Outlook, Apple Calendar, or any calendar app.</p>
<h2>9. Deletion and Activity Log</h2>
<ul>
<li><strong>Single delete</strong>: open a visit and click Delete with confirmation.</li>
<li><strong>Batch delete</strong>: select multiple visits from the table and click the delete icon.</li>
<li>Every creation, draft save, update, and deletion is logged in the <strong>Activity Log</strong> — accessible per-visit and globally.</li>
</ul>
<h2>Related Modules</h2>
<p>Site visits connect to these areas of the system:</p>
<table><thead><tr><th>Module</th><th>Relationship</th></tr></thead><tbody>
<tr><td>--------</td><td>-------------</td></tr>
<tr><td><strong>Projects</strong></td><td>Visits are linked to projects; shortcuts exist to schedule from the project view</td></tr>
<tr><td><strong>Clients</strong></td><td>Every visit is tied to a client record</td></tr>
<tr><td><strong>Leads</strong></td><td>Visits can optionally reference a lead</td></tr>
<tr><td><strong>Client Communication</strong></td><td>Communications can create linked site visits</td></tr>
<tr><td><strong>Subcontractors</strong></td><td>JMS measurements tie to subcontractor records</td></tr>
<tr><td><strong>Project Equipment</strong></td><td>T&amp;C protocols reference equipment on the project</td></tr>
<tr><td><strong>Project Insights</strong></td><td>Observations feed into the project insights timeline</td></tr>
<tr><td><strong>Approvals</strong></td><td>Visit approval integrates with the workflow engine</td></tr>
<tr><td><strong>Dashboard</strong></td><td>Pending follow-ups appear in next actions</td></tr>
<tr><td><strong>Follow-Up Centre</strong></td><td>Overdue and upcoming visits appear in the unified queue</td></tr>
</tbody></table>',
  (select id from public.kb_categories where slug = 'field-operations'),
  6,
  '{}'::text[],
  'published'::public.content_status, now(), now()
from public.pages p
join (values ('/help/site-visit-management')) as v(slug) on v.slug = p.slug
where not exists (select 1 from public.kb_articles k where k.page_id = p.id)
on conflict do nothing;
