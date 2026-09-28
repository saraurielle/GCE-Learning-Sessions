# Member 1 — Content Module (Subjects & Papers)

Owns everything about **what content exists**: the 9 subjects, past-paper
years, and the actual paper questions shown in `learning.html`.

## Endpoints

| Method | Route                                      | Purpose                                   |
|--------|---------------------------------------------|--------------------------------------------|
| GET    | `/api/subjects`                             | List all 9 subjects                        |
| GET    | `/api/subjects/:id`                         | Get one subject's details                  |
| GET    | `/api/papers/:subjectId`                    | List available years/papers for a subject  |
| GET    | `/api/papers/:subjectId/:year/:paper`       | Get the questions for one paper            |

## Files

- `models/Subject.js`, `models/Paper.js` — data shape reference classes
- `controllers/subjectsController.js`, `controllers/papersController.js` — request handlers
- `routes/subjects.js`, `routes/papers.js` — Express routers, mounted by Member 3's `server.js`
- `data/subjects.json` — the 9 subjects
- `data/papers.json` — past-paper content, structured as:
  ```
  { subjectId: { year: { paperNumber: [ [title, prompt, explanation], ... ] } } }
  ```

## Your main job

`data/papers.json` now has sample questions for all 9 subjects. **Replace them
with real content** and add more years/papers, following the same structure.
The frontend lists whatever years and papers the API returns. No code changes are needed to add
data, just extend the JSON.

## Testing your routes alone

```bash
cd member1-content
node -e "const app=require('express')(); app.use('/api/subjects', require('./routes/subjects')); app.use('/api/papers', require('./routes/papers')); app.listen(4001, () => console.log('Member 1 routes on :4001'))"
```
Then visit `http://localhost:4001/api/subjects` in a browser.
