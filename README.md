# Marketguard

A local proof of concept for researching Facebook Marketplace vehicle listings. React and Vite power the UI; Express handles authentication and model requests; SQLite persists users, revocable sessions, and private query history.

## Run locally

Requires Node.js 22.13+ (tested on 22.22). Uses Node's built-in SQLite driver, which emits an experimental-feature notice on Node 22.

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. The backend and frontend share the same origin and port. If port 3000 is occupied, set `PORT=3001 npm run dev`.

Create an account or choose **Explore the demo**. Each demo visit creates a separate workspace with six clearly marked sample queries. Normal accounts start with empty history. Login sessions persist across refreshes and local server restarts for one hour. Data is stored in `data/marketguard.sqlite`; this file and the locally generated signing key are ignored by Git.

```sh
npm test
npm run build
```

For a production-mode local check, set a strong `JWT_SECRET`, run `npm run build`, and then `npm start`. Production cookies are Secure, so an HTTPS origin is required for authentication. The development command is intended for the requested local HTTP app.

## ML notebook

Model development starts in [`notebook/main.ipynb`](notebook/main.ipynb). Create the Conda environment and register its Jupyter kernel:

```sh
conda env create -f notebook/environment.yml
conda activate marketguard-ml
python -m ipykernel install --user --name marketguard-ml --display-name "Python (marketguard-ml)"
jupyter lab notebook/main.ipynb
```

Select **Python (marketguard-ml)** and run all cells. The notebook imports pandas, NumPy, and scikit-learn, validates the environment and live kernel, and trains a small classifier on synthetic data as an installation check. This synthetic check does not measure Marketplace fraud detection performance. Saved cell outputs show the last successful run.

To execute and refresh the saved outputs from the project root:

```sh
conda run -n marketguard-ml python -c 'from pathlib import Path; import nbformat; from nbclient import NotebookClient; p = Path("notebook/main.ipynb"); n = nbformat.read(p, as_version=4); NotebookClient(n, timeout=120, kernel_name="marketguard-ml", resources={"metadata": {"path": str(p.parent.resolve())}}).execute(); nbformat.write(n, p)'
```

## What works

- Sign up, sign in, and sign out; bcrypt password hashes.
- Signed HS256 JWT in an HttpOnly, SameSite=Lax cookie. Both JWT and SQLite session expire after **1 hour**; expiration does not slide with activity. Sign-out revokes the session immediately.
- User-scoped SQLite queries. One user cannot retrieve another user's queries.
- Listing URL validation, query submission, saved results, first listing photo, vehicle details, reasons, prediction, and model confidence.
- Search by vehicle/location, prediction filters, date sorting, list/grid layouts, pagination, and a seven-day activity chart derived from stored queries.
- Responsive navigation, profile dropdown, and a placeholder Settings page.
- Server-side input/response validation, same-origin mutation checks, basic request limiting, and explicit model timeout/error states.

## Connect the model API

Copy `.env.example` to `.env`, set `MODEL_API_URL`, optionally set `MODEL_API_KEY`, and restart the server. Keep the key on the backend. The integration boundary is **`server/model.js` → `analyzeListing()`**.

Until the URL is configured, the adapter returns deterministic **sample** data. It does not fetch Facebook, read the submitted publication, or perform real fraud detection. The demo UI and each demo result state this explicitly. The demo adapter chooses a fixture by listing ID or URL hash; its verdict is not evidence about the supplied URL. Model failures never fall back to a fabricated successful analysis.

The backend makes this request:

```http
POST <MODEL_API_URL>
Content-Type: application/json
Authorization: Bearer <MODEL_API_KEY>  # only if set
```

```json
{
  "listing_url": "https://www.facebook.com/marketplace/item/104827365901284/"
}
```

Return JSON with this contract:

```json
{
  "prediction": "trustworthy",
  "confidence": 0.96,
  "details": {
    "title": "2021 BMW 3 Series",
    "price": 28500,
    "currency": "USD",
    "year": 2021,
    "mileage": 32400,
    "location": "San Diego, CA",
    "transmission": "Automatic",
    "seller_name": "Alex Morgan",
    "description": "Vehicle listing description."
  },
  "photos": [
    "https://your-image-host.example/first-publication-photo.jpg"
  ],
  "reasons": [
    "Asking price is consistent with comparable vehicles.",
    "Vehicle details appear consistent."
  ]
}
```

- `prediction`: `fraud` or `trustworthy`. The aliases `trust`, `trusted`, and `thrust` normalize to `trustworthy` at the API boundary.
- `confidence`: a number from 0 to 1, interpreted as confidence in the returned class, not a probability of fraud in every case.
- `details.title`, `details.price`, and `reasons` are required. Unknown price/mileage/year can be `null`. Omitted optional details receive a “Not provided” fallback.
- `currency`: uppercase ISO 4217 code; defaults to USD. `mileage` is in miles.
- `photos`: publication photos in order. The app shows the **first photo**, or a placeholder if none is provided or the image fails to load. URLs must use HTTPS. The model service must return stable accessible image URLs; it is responsible for obtaining the actual listing and its first photo.
- `reasons`: 1–10 explanatory strings.
- A failed request, invalid JSON, invalid contract, or timeout shows an error and does not save a query. Default timeout is 30 seconds; override with `MODEL_API_TIMEOUT_MS`.

The URL is validated and sent only to the configured model endpoint. The web server never requests a user-supplied listing URL directly.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{name,email,password}`; create account and session |
| POST | `/api/auth/login` | `{email,password}`; begin session |
| POST | `/api/auth/demo` | Create isolated demo workspace and session |
| GET | `/api/auth/me` | Current user and absolute session expiry |
| POST | `/api/auth/logout` | Revoke session and clear cookie |
| GET | `/api/config` | Authenticated model mode (`demo` or `live`) |
| GET | `/api/queries` | Current user's history |
| POST | `/api/queries` | `{listing_url}`; analyze and persist result |
| GET | `/api/queries/:id` | One owned query, or 404 |
| GET | `/api/health` | Server readiness |

The local app binds to 127.0.0.1. Before an external deployment, configure HTTPS and a managed signing secret, set proxy trust correctly for the deployment, and replace the in-memory limiter with a shared store if scaling beyond one process. Demo accounts are persisted locally; there is no background cleanup of demo workspaces in this PoC.

## Sample image credits

Sample car and profile photographs are from Unsplash, bundled in `public/images` so demo thumbnails work without an image-host request at runtime. They are illustrative and not actual Marketplace publication photos.

- BMW: `photo-1555215695-3004980ad54e`
- Mercedes: `photo-1618843479313-40f8afb4b4d8`
- Tesla: `photo-1560958089-b8a1929cea89`
- Porsche: `photo-1503376780353-7e6692767b70`
- Audi: `photo-1606664515524-ed2f786a0bd6`
- Jeep: `photo-1519641471654-76ce0107ad1b`
- Profile: `photo-1506794778202-cad84cf45f1d`
