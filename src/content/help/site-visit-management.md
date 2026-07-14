---
title: "Site Visit Management & Field Operations"
description: "End-to-end guide for planning, executing, and closing site visits with check-in/out, measurements, testing, sign-off, and follow-ups."
category: "Field Operations"
lastUpdated: "2026-07-14"
---

Site visits are the bridge between your office and the field. Every visit — whether a survey, installation, inspection, or handover — generates artifacts that flow into projects, client communication, approvals, and financial records.

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

Open any project and click the **Schedule Site Visit** shortcut — it pre-fills the client and project IDs so you don't have to search.

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

1. Enter the client representative's **Name** and **Designation**.
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
3. On approval, the visit is confirmed. On rejection, it's returned with status `Rejected`.

## 7. Follow-Ups and Next Actions

Every completed visit can generate a **next step** and **follow-up date**:

1. The visit appears on the Dashboard's **Next Actions** widget.
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
| **Follow-Up Centre** | Overdue and upcoming visits appear in the unified queue |
