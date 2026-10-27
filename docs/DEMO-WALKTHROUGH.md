# Sprint 2 demonstration — approximately 5 minutes

Use this inside the existing 15–20 minute presentation. Start the application before presenting, sign in as `admin@kontrack.demo`, and select **Projects**, and open **Example project**. All content is synthetic.

## 0:00–0:40 — Project and access

- Explain that KonTraCk keeps construction issues attached to their drawing locations.
- Show the project overview and Team page. Identify the administrator, inspector, contractor, and reviewer roles.
- State that the server checks project membership for records and file downloads. A hidden button alone is not an access control.

## 0:40–1:30 — Drawing workflow

- Open Plans. Select **Upload Drawing** and choose `demo/Sprint-2-Example-Plan.pdf` if demonstrating upload live; otherwise use the seeded copy.
- Show both pages, then return to page 1. Use zoom, Fit, and Pan.
- Explain that the application parses the PDF and saves page metadata with the project. Invalid PDFs are rejected.

## 1:30–2:35 — Create a punch item

- Select **Place punch item**, then click a drawing location.
- Enter a concrete title, such as “Adjust Room 101 door closer.” Describe what needs to be inspected or corrected.
- Save. Point out the saved description, drawing, and page.
- Explain that the saved position is relative to the PDF page and does not depend on a particular screen size.

## 2:35–3:35 — Edit and prove restoration

- Edit the description and select **Save item**. The saved version increases while the location remains fixed.
- Select **View saved marker on drawing**. Reload and open the same marker again.
- Zoom and collapse and expand the teammate's sidebar. The drawing resizes and the marker stays on its original location.
- Optionally repeat on page 2 to demonstrate the rotated PDF case.

## 3:35–4:30 — Explain validation

- Explain that two simultaneous edits cannot silently overwrite one another: a stale save receives a conflict and must reload.
- Show the recorded integration results: 24 Node test results and 62 supplied database assertions. Explain one successful case and one rejected case.
- If time permits, sign out and use `outsider@kontrack.demo`. The Example project must not appear. Return to the administrator for discussion.

## 4:30–5:00 — Close the walkthrough

- Connect the demo to the Sprint 2 vertical slice: authenticated project → PDF → anchored item → persistent edit → restored marker.
- Separate demonstrated behavior from future work. Complete markup tools, export generation, production email, performance targets, and stakeholder acceptance are not established by this demo.

## Presenter recovery

- Reuse the seeded drawing if upload is slow. Do not describe a fallback as a successful live upload.
- If an edit reports a conflict, select Reload, review the latest values, and retry.
- If the API is unavailable, check the terminal and restart with `npm run demo`; saved data remains in the local database and storage directory.
- Use the supplied preview as a visual fallback, identifying it as a screenshot of a verified local run.
