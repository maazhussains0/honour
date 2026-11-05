# Honour — static demo build

This build runs as a static website. It does not need `server.js`, Node.js, API routes,
or a database server.

## Deploy to Vercel

1. Extract this ZIP.
2. Put `index.html` and `demo-data.json` in the root of your GitHub repository.
3. Import that repository into Vercel.
4. Keep the Framework Preset as **Other** and leave the build/output settings empty/default.
5. Deploy.

Both files must remain together in the published root.

## Run locally

From the extracted folder, run:

    python -m http.server 8000

Then open http://localhost:8000

## Demo accounts

- Student: `student01` / `student123`
- Teacher: `teacher01` / `teacher123`
- HOD: `hod` / `hod123`

For student accounts, the app also accepts the full school email
(e.g. `student01@habibschools.edu.pk`).

## Important demo limitations

- This is a demonstration system, not secure production authentication.
- Activity and ratings are saved in the current browser using localStorage.
- Each visitor/browser has its own copy of demo activity. Changes are not shared
  between visitors and may be cleared if browser site data is cleared.
- Password reset/email delivery is disabled in this static demo.
- Do not use real student information or deploy this as a production school system.
