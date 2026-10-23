import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, ExternalLink, Eye, EyeOff, FileSearch, HelpCircle, LayoutGrid, Link2, LoaderCircle, LockKeyhole, LogOut, MapPin, Menu, Monitor, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, X } from 'lucide-react';

const SAMPLE_URL = 'https://www.facebook.com/marketplace/item/104827365901284/';
const money = (value, currency = 'USD') => value == null ? 'Price not provided' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const formatDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const initials = name => name?.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}
function Logo({ light = false }) { return <div className={`logo ${light ? 'light' : ''}`}><span className="logo-symbol"><img className="logo-mark" src="/favicon.svg?v=3" alt="" aria-hidden="true" /></span><span>marketguard<span className="logo-dot">.</span></span></div>; }
function Avatar({ user, small = false }) { return user.is_demo ? <img className={`avatar ${small ? 'small' : ''}`} src="/images/avatar.jpg" alt={user.name} /> : <span className={`avatar initials ${small ? 'small' : ''}`}>{initials(user.name)}</span>; }
function Badge({ prediction, small = false }) { return <span className={`badge ${prediction === 'fraud' ? 'risk' : 'safe'} ${small ? 'small' : ''}`}>{prediction === 'fraud' ? <CircleAlert size={13} /> : <ShieldCheck size={13} />}{prediction === 'fraud' ? 'Potential fraud' : 'Likely trustworthy'}</span>; }
function ListingImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} {...props} /> : <div className={`image-placeholder ${props.className || ''}`}><FileSearch size={32} /><span>Photo unavailable</span></div>;
}
function ErrorBox({ children }) { return children ? <div className="error-box" role="alert"><CircleAlert size={17} /><span>{children}</span></div> : null; }

function Auth({ onLogin, notice }) {
  const [signup, setSignup] = useState(location.pathname === '/signup');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy('form'); setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try { onLogin(await api(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(form) })); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function enterDemo() {
    setBusy('demo'); setError('');
    try { onLogin(await api('/auth/demo', { method: 'POST' })); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  function switchMode() { setSignup(!signup); setError(''); history.replaceState({}, '', signup ? '/login' : '/signup'); }
  return <main className="auth-page">
    <section className="auth-story">
      <Logo light />
      <div className="auth-story-content"><span className="eyebrow light-eyebrow"><span /> A SMARTER WAY TO SHOP</span><h1>Your next car.<br />A little more<br /><span>peace of mind.</span></h1><p>Get a clearer picture of a Marketplace listing.<br />Keep the excitement. Check the details.</p>
        <div className="auth-preview"><ListingImage src="/images/bmw.jpg" alt="Silver BMW on a palm-lined street" /><div className="auth-preview-info"><div><span className="overline">YOUR NEXT POSSIBILITY</span><h3>2021 BMW 3 Series</h3><span>32,400 miles · San Diego, CA</span></div><span className="auth-preview-check"><ShieldCheck size={26} /></span></div><div className="auth-preview-verdict"><Badge prediction="trustworthy" small /><span>Sample analysis</span></div></div>
      </div>
      <div className="auth-story-footer"><span><ShieldCheck size={16} /> More clarity. Better decisions.</span><span>Built for the journey ahead ↗</span></div>
    </section>
    <section className="auth-form-section"><div className="auth-top">{signup ? 'Already have an account?' : 'New to Marketguard?'} <button className="text-button" onClick={switchMode}>{signup ? 'Sign in' : 'Create an account'} <ArrowUpRight size={15} /></button></div>
      <div className="auth-form-wrap"><span className="section-kicker">YOUR RESEARCH STARTS HERE</span><h2>{signup ? 'A smarter start.' : 'Welcome back.'}<span className="purple-dot">✦</span></h2><p className="auth-subtitle">{signup ? 'Create your account. Find your next car with confidence.' : 'A little due diligence goes a long way.'}</p>
        {notice && <div className="notice-box">{notice}</div>}<ErrorBox>{error}</ErrorBox>
        <form onSubmit={submit}>
          {signup && <label>Full name<input name="name" placeholder="Alex Morgan" autoComplete="name" minLength={2} maxLength={80} required /></label>}
          <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} required /></label>
          <label>Password<div className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} maxLength={72} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <div className="session-note"><LockKeyhole size={14} /> Your session stays signed in for 1 hour.</div>
          <button className="button primary auth-submit" disabled={!!busy}>{busy === 'form' ? <LoaderCircle className="spin" size={18} /> : <>{signup ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></>}</button>
        </form>
        <div className="or-divider"><span />or take a look around<span /></div>
        <button className="button demo-button" onClick={enterDemo} disabled={!!busy}>{busy === 'demo' ? <LoaderCircle className="spin" size={18} /> : <><Sparkles size={17} />Explore the demo<ArrowUpRight size={17} /></>}</button>
        <p className="auth-footnote">No account needed for the demo. Sample listings included.</p>
      </div>
      <div className="auth-bottom"><span>© {new Date().getFullYear()} Marketguard</span><span><LockKeyhole size={13} /> Your research, kept private</span></div>
    </section>
  </main>;
}

function ActivityChart({ queries }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); d.setHours(0, 0, 0, 0); return d; });
  const counts = days.map(date => queries.filter(q => { const d = new Date(q.created_at); return d >= date && d < new Date(+date + 86400000); }).length);
  const max = Math.max(3, ...counts);
  const coords = counts.map((count, i) => [35 + i * 87, 94 - count / max * 70]);
  const path = coords.map(([x, y], i) => i === 0 ? `M${x},${y}` : `C${x - 42},${coords[i - 1][1]} ${x - 42},${y} ${x},${y}`).join(' ');
  return <div className="chart-wrap"><svg viewBox="0 0 592 123" role="img" aria-label={`Queries over the last seven days: ${counts.join(', ')}`} preserveAspectRatio="none"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8c75ed" stopOpacity=".20" /><stop offset="100%" stopColor="#8c75ed" stopOpacity="0" /></linearGradient></defs>{[24, 59, 94].map((y, i) => <g key={y}><line x1="30" y1={y} x2="575" y2={y} stroke="#edeef3" strokeDasharray="4 5" /><text x="2" y={y + 4} fill="#b4b3bf" fontSize="10">{Math.round(max * (1 - i / 2))}</text></g>)}<path d={`${path} L557,108 L35,108 Z`} fill="url(#chart-fill)" /><path d={path} fill="none" stroke="#8064eb" strokeWidth="2.7" />{coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 6 ? 4 : 2.5} fill="white" stroke="#8064eb" strokeWidth="2"><title>{shortDate(days[i])}: {counts[i]} queries</title></circle>)}{days.map((day, i) => <text key={i} x={coords[i][0]} y="122" textAnchor="middle" fill="#9c9ba9" fontSize="10">{day.toLocaleDateString('en-US', { weekday: 'short' })}</text>)}</svg></div>;
}

function Detail({ query, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const risky = query.prediction === 'fraud';
  return <dialog ref={dialog} aria-label={`Analysis for ${query.details.title}`} className="detail-dialog" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}><div className="detail-content"><div className="detail-header"><span><span className="section-kicker">LISTING ANALYSIS</span><span className="detail-id">#{query.id.slice(0, 8).toUpperCase()}</span></span><button className="icon-button" onClick={onClose} aria-label="Close details"><X size={20} /></button></div>
    <div className="detail-photo"><ListingImage src={query.photos[0]} alt={query.details.title} /><span className="image-label">{query.source === 'demo' ? 'Sample listing photo' : 'First listing photo'}</span></div>
    <div className="detail-body"><div className="detail-title"><div><h2>{query.details.title}</h2><p><MapPin size={14} />{query.details.location}</p></div><strong>{money(query.details.price, query.details.currency)}</strong></div>
      {query.source === 'demo' && <div className="notice-box"><Sparkles size={16} /> Demo result. Photos, vehicle details, and verdict are illustrative; this listing has not been verified.</div>}
      <div className={`verdict-panel ${risky ? 'risky' : ''}`}><span className="verdict-icon">{risky ? <CircleAlert size={24} /> : <ShieldCheck size={24} />}</span><div><h3>{risky ? 'Take a closer look.' : 'Looking promising.'}</h3><p>{risky ? 'This analysis found signals that need extra attention.' : 'This analysis found reassuring signals in the listing.'}</p></div><div className="confidence"><strong>{Math.round(query.confidence * 100)}%</strong><span>model confidence</span></div></div>
      <div className="vehicle-specs"><div><span>Year</span><strong>{query.details.year || 'Not provided'}</strong></div><div><span>Mileage</span><strong>{query.details.mileage == null ? 'Not provided' : `${query.details.mileage.toLocaleString('en-US')} mi`}</strong></div><div><span>Transmission</span><strong>{query.details.transmission}</strong></div><div><span>Seller</span><strong>{query.details.seller_name}</strong></div></div>
      <h3 className="reason-heading">What informed this result</h3><div className="reasons">{query.reasons.map((reason, i) => <div key={i}>{risky ? <CircleAlert size={17} /> : <Check size={17} />}<span>{reason}</span></div>)}</div>
      {query.details.description && <p className="listing-description">{query.details.description}</p>}
      <p className="result-disclaimer">A prediction is a starting point, not a guarantee. Meet the seller, inspect the vehicle, and verify its history before making a payment.</p>
      <div className="detail-footer"><span><Clock3 size={14} />{formatDate(query.created_at)}</span><a className="button primary" href={query.listing_url} target="_blank" rel="noreferrer">View original listing <ExternalLink size={15} /></a></div>
    </div></div></dialog>;
}

function ListingLinkGuide() {
  // Reviewed against Meta's Help Center on 2026-10-22:
  // https://www.facebook.com/help/1178996282113119/
  // Mobile docs describe Share; Copy link is explicitly documented on web.
  // Keep the mobile copy step conditional and offer the documented web route.
  const helpUrl = 'https://www.facebook.com/help/1178996282113119/';
  return <section className="listing-link-guide" aria-labelledby="listing-link-guide-title">
    <div className="link-guide-heading">
      <span className="link-guide-icon"><Link2 size={17} aria-hidden="true" /></span>
      <h3 id="listing-link-guide-title">How to copy a listing link</h3>
    </div>
    <div className="link-guide-platforms">
      <div className="link-guide-platform">
        <h4><Smartphone size={15} aria-hidden="true" />Mobile app <span>iPhone & Android</span></h4>
        <ol>
          <li>In Facebook, tap <strong>Menu → Marketplace</strong> and open the vehicle listing. Tap <strong>See more</strong> if Marketplace is hidden.</li>
          <li>Tap <strong>Share</strong> below the listing photo, then choose <strong>Copy link</strong> if your app offers it.</li>
          <li>Return here and paste the link into the field below.</li>
        </ol>
      </div>
      <div className="link-guide-platform">
        <h4><Monitor size={15} aria-hidden="true" />Web browser <span>Computer</span></h4>
        <ol>
          <li>On Facebook, select <strong>Marketplace</strong> in the left menu, then open the vehicle listing. Use <strong>See more</strong> if needed.</li>
          <li>Click <strong>Share → Copy link</strong> to copy that listing’s link.</li>
          <li>Return here and paste the link into the field below.</li>
        </ol>
      </div>
    </div>
    <p className="link-guide-fallback"><HelpCircle size={14} aria-hidden="true" /><span>No <strong>Copy link</strong> option in the app? Use Facebook on a computer and follow the web steps.</span></p>
    <p className="link-guide-format">Use a direct vehicle link containing <code>/marketplace/item/</code>. If Facebook gives you a short share link, open it in a browser and copy the full listing address.</p>
    <div className="link-guide-sources">
      <span>Meta may change these menus. Check its official guide:</span>
      <div>
        <a href={`${helpUrl}?cms_platform=android-app`} target="_blank" rel="noopener noreferrer">Android<ExternalLink size={11} aria-hidden="true" /></a>
        <a href={`${helpUrl}?cms_platform=iphone-app`} target="_blank" rel="noopener noreferrer">iPhone<ExternalLink size={11} aria-hidden="true" /></a>
        <a href={`${helpUrl}?cms_platform=www`} target="_blank" rel="noopener noreferrer">Web<ExternalLink size={11} aria-hidden="true" /></a>
      </div>
    </div>
  </section>;
}

function QueryPage({ mode, onCreated, onView, navigate }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  async function analyze(event) {
    event.preventDefault(); setError(''); setBusy(true); setResult(null);
    try { const data = await api('/queries', { method: 'POST', body: JSON.stringify({ listing_url: url }) }); setResult(data.query); onCreated(data.query); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="query-page"><div className="page-heading"><div><span className="section-kicker">A SECOND LOOK GOES A LONG WAY</span><h1>Meet your next possibility<span className="purple-dot">.</span></h1><p>One link. A clearer picture of what’s behind the listing.</p></div></div>
    <div className="query-layout"><section className="panel query-form-card"><span className="square-icon purple"><Link2 size={25} /></span><h2>Let’s look under the hood.</h2><p>Paste a Facebook Marketplace vehicle link below to get started.</p>
      <ListingLinkGuide />
      <form onSubmit={analyze}><label htmlFor="listing-url">Marketplace listing URL</label><div className={`listing-input ${busy ? 'disabled' : ''}`}><Link2 size={18} /><input id="listing-url" type="url" placeholder="https://www.facebook.com/marketplace/item/..." value={url} onChange={e => setUrl(e.target.value)} maxLength={2048} disabled={busy} required /></div><ErrorBox>{error}</ErrorBox><div className="query-form-meta"><span><LockKeyhole size={13} /> Only you can see your queries</span>{mode === 'demo' && <button type="button" className="text-button" disabled={busy} onClick={() => { setUrl(SAMPLE_URL); setError(''); }}>Try a sample link<ArrowUpRight size={13} /></button>}</div><button className="button primary analyze-button" disabled={busy || !url.trim()}>{busy ? <><LoaderCircle size={18} className="spin" />Analyzing listing…</> : <><Sparkles size={18} />Analyze listing<ArrowRight size={18} /></>}</button></form>
      <div className="mode-notice"><span className={`status-dot ${mode === 'live' ? 'live' : ''}`} /><div><strong>{mode === 'demo' ? 'You’re in demo mode' : 'Model API connected'}</strong><p>{mode === 'demo' ? 'Explore with sample vehicle details and predictions. Submitted listings are not fetched or verified.' : 'Your listing will be sent to the connected model for analysis.'}</p></div></div>
    </section><aside className="query-side"><div className="panel steps-panel"><h3>A little insight, in three steps.</h3>{[['01', 'Find a possibility', 'Copy the vehicle listing’s link from Facebook Marketplace.'], ['02', 'Get the full picture', 'Review vehicle details, listing signals, and the model’s prediction.'], ['03', 'Make your next move', 'Revisit your analysis anytime in My queries.']].map(([n, title, desc]) => <div className="step" key={n}><span>{n}</span><div><h4>{title}</h4><p>{desc}</p></div></div>)}</div><div className="query-tip"><ShieldCheck size={21} /><p>Great research is just the start.<br /><strong>Always inspect before you invest.</strong></p></div></aside></div>
    {busy && <section className="panel analyzing-panel" role="status"><span className="analyzing-orbit"><ShieldCheck size={28} /></span><div><h3>Looking into your listing</h3><p>{mode === 'demo' ? 'Preparing an illustrative analysis…' : 'Waiting for vehicle details and signals from the model…'}</p></div></section>}
    {result && <section className="panel inline-result"><div className="inline-result-image"><ListingImage src={result.photos[0]} alt={result.details.title} /></div><div className="inline-result-body"><span className="section-kicker">{result.source === 'demo' ? 'SAMPLE ANALYSIS COMPLETE' : 'ANALYSIS COMPLETE'}<CheckCheck size={14} /></span><h2>{result.details.title}</h2><p><MapPin size={14} />{result.details.location}<span>·</span>{money(result.details.price, result.details.currency)}</p><Badge prediction={result.prediction} /><p className="inline-result-note">Saved to My queries. {result.source === 'demo' ? 'This is sample data, not an assessment of the submitted listing.' : 'Open the full analysis to review the signals.'}</p></div><button className="button secondary" onClick={() => onView(result)}>View analysis<ArrowUpRight size={16} /></button></section>}
    <button className="text-button back-to-queries" onClick={() => navigate('/')}><ArrowLeft size={15} />Back to My queries</button>
  </div>;
}

function QueriesPage({ user, queries, loading, error, onRetry, navigate, onView, mode }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const safe = queries.filter(q => q.prediction === 'trustworthy').length;
  const risky = queries.length - safe;
  const filtered = queries.filter(q => (filter === 'all' || q.prediction === filter) && `${q.details.title} ${q.details.location}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'newest' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 5, currentPage * 5);
  return <><div className="page-heading dashboard-heading"><div><span className="greeting">A LITTLE RESEARCH. A BETTER ROAD AHEAD.</span><h1>Your next car starts with clarity<span className="purple-dot">.</span></h1><p>Welcome back, {user.name.split(' ')[0]}. Let’s keep your next move a confident one.</p></div><button className="button primary new-query-button" onClick={() => navigate('/query')}><Plus size={17} />New query</button></div>
    <div className="dashboard-top"><section className="overview"><div className="stat-grid"><div className="panel stat"><span className="stat-label">Total queries <span className="square-icon purple"><FileSearch size={18} /></span></span><div className="stat-value">{String(queries.length).padStart(2, '0')}<span className="stat-trend"><ArrowUpRight size={12} />Your research, in one place</span></div><p>Every possibility you’ve explored</p></div><div className="panel stat"><span className="stat-label">Likely trustworthy <span className="square-icon mint"><ShieldCheck size={18} /></span></span><div className="stat-value">{String(safe).padStart(2, '0')}<span className="stat-pill safe-text">{queries.length ? Math.round(safe / queries.length * 100) : 0}% of queries</span></div><p>A promising place to start</p></div><div className="panel stat"><span className="stat-label">Flagged for a closer look <span className="square-icon coral"><CircleAlert size={18} /></span></span><div className="stat-value">{String(risky).padStart(2, '0')}<span className="stat-pill risk-text">Stay one step ahead</span></div><p>A little caution goes a long way</p></div></div>
      <div className="panel activity-panel"><div className="panel-heading"><div><h3>Your research, at a glance</h3><p>Small checks. More informed decisions.</p></div><span className="chart-period"><span className="purple-bullet" />Queries <span>Last 7 days<ChevronDown size={12} /></span></span></div><ActivityChart queries={queries} /></div>
    </section><aside className="clarity-card"><div className="clarity-card-top"><span className="pill-outline"><span /> YOUR CO-PILOT, NOT AUTOPILOT</span><ArrowUpRight size={20} /></div><div className="shield-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="orbit-point one" /><span className="orbit-point two" /><span className="floating-tile tile-one"><Check size={15} /></span><span className="floating-tile tile-two"><Sparkles size={16} /></span><span className="hero-shield"><ShieldCheck size={59} strokeWidth={1.3} /></span></div><h2>Good finds.<br />Better peace of mind.</h2><p>Go beyond the listing.<br />Know what deserves a second look.</p><button onClick={() => navigate('/query')}>Check a listing<ArrowRight size={16} /></button></aside></div>
    <section className="panel history-panel"><div className="history-heading"><div><h2>My queries <span className="count-badge">{queries.length}</span></h2><p>Your possibilities, with a little more perspective.</p></div><div className="history-tools"><div className="search-field"><Search size={16} /><input type="search" aria-label="Search queries" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search vehicles…" /></div><div className="filter-wrap"><button className={`button filter-button ${filterOpen ? 'selected' : ''}`} onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen}><SlidersHorizontal size={15} /><span>Sort</span></button>{filterOpen && <div className="sort-menu"><span>Sort by date</span>{[['newest', 'Newest first'], ['oldest', 'Oldest first']].map(([value, label]) => <button key={value} onClick={() => { setSort(value); setFilterOpen(false); setPage(1); }}>{label}{sort === value && <Check size={14} />}</button>)}</div>}</div><div className="view-toggle"><button className={view === 'list' ? 'active' : ''} aria-label="List view" onClick={() => setView('list')}><Menu size={16} /></button><button className={view === 'grid' ? 'active' : ''} aria-label="Grid view" onClick={() => setView('grid')}><LayoutGrid size={15} /></button></div></div></div>
      <div className="history-tabs">{[['all', 'All queries', queries.length], ['trustworthy', 'Likely trustworthy', safe], ['fraud', 'Potential fraud', risky]].map(([value, label, count]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setPage(1); }}>{label}<span>{count}</span></button>)}<span className="history-saved"><span />Saved just for you</span></div>
      {loading ? <div className="empty-state"><LoaderCircle className="spin" /><h3>Loading your research…</h3></div> : error ? <div className="empty-state"><CircleAlert /><h3>We couldn’t load your queries.</h3><p>{error}</p><button className="button secondary" onClick={onRetry}>Try again</button></div> : filtered.length === 0 ? <div className="empty-state"><span className="empty-icon"><FileSearch size={29} /></span><h3>{queries.length ? 'No matches just yet.' : 'Your next possibility is out there.'}</h3><p>{queries.length ? 'Try another search or change your filters.' : 'Start with a Marketplace vehicle link. We’ll keep your research here.'}</p><button className="button primary" onClick={() => queries.length ? (setSearch(''), setFilter('all')) : navigate('/query')}>{queries.length ? 'Clear filters' : 'Check your first listing'}<ArrowRight size={15} /></button></div> : view === 'list' ? <div className="table-scroll"><table><thead><tr><th>Vehicle</th><th>Asking price</th><th>Analysis</th><th>Date checked<ArrowDown size={11} /></th><th aria-label="Actions" /></tr></thead><tbody>{visible.map(query => <tr key={query.id}><td><button className="vehicle-cell" onClick={() => onView(query)}><ListingImage src={query.photos[0]} alt={query.details.title} /><span><strong>{query.details.title}</strong><span><MapPin size={11} />{query.details.location}{query.source === 'demo' && <span className="sample-tag">Sample</span>}</span></span></button></td><td><strong className="table-price">{money(query.details.price, query.details.currency)}</strong><span className="table-subtitle">{query.details.mileage == null ? 'Mileage unavailable' : `${query.details.mileage.toLocaleString('en-US')} miles`}</span></td><td><Badge prediction={query.prediction} small /></td><td><span className="date-cell">{formatDate(query.created_at)}</span><span className="table-subtitle">{query.source === 'demo' ? 'Demo analysis' : 'Model analysis'}</span></td><td><button className="icon-button row-action" onClick={() => onView(query)} aria-label={`View analysis for ${query.details.title}`}><ArrowUpRight size={18} /></button></td></tr>)}</tbody></table></div> : <div className="query-grid">{visible.map(q => <button className="query-grid-card" key={q.id} onClick={() => onView(q)}><div className="grid-photo"><ListingImage src={q.photos[0]} alt={q.details.title} />{q.source === 'demo' && <span className="image-label">Sample listing</span>}</div><div className="grid-card-info"><h3>{q.details.title}</h3><p><MapPin size={12} />{q.details.location}</p><div><strong>{money(q.details.price, q.details.currency)}</strong><ArrowUpRight size={17} /></div><Badge prediction={q.prediction} small /></div></button>)}</div>}
      <div className="table-footer"><span>{filtered.length ? `Showing ${(currentPage - 1) * 5 + 1}–${Math.min(currentPage * 5, filtered.length)} of ${filtered.length} queries` : 'No queries to show'}</span><div className="pagination"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} />Previous</button><span>{currentPage}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={14} /></button></div></div>
    </section><div className="dashboard-footer"><span><ShieldCheck size={14} />A second opinion. A more informed decision.</span><span>{mode === 'demo' ? <><span className="status-dot" />Demo mode · Sample data</> : <><span className="status-dot live" />Model API connected</>}</span></div>
  </>;
}

function SettingsPage({ user, session, mode }) {
  return <div className="settings-page"><div className="page-heading"><div><span className="section-kicker">MAKE YOURSELF AT HOME</span><h1>A space of your own<span className="purple-dot">.</span></h1><p>Your profile and preferences, all in one place.</p></div></div><section className="panel settings-card"><div className="settings-profile"><Avatar user={user} /><div><h2>{user.name}</h2><p>{user.is_demo ? 'Demo workspace' : user.email}</p></div><span className="coming-pill">PREVIEW</span></div><div className="settings-row"><div><h3>Account details</h3><p>Profile editing will be available in a future update.</p></div><LockKeyhole size={20} /></div><div className="settings-row"><div><h3>Session security</h3><p>Your session expires at {new Date(session.expires_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Sign in again to start a new session.</p></div><span className="badge safe"><ShieldCheck size={13} />1-hour session</span></div><div className="settings-row"><div><h3>Analysis connection</h3><p>{mode === 'demo' ? 'Using illustrative sample results while the model API is being built.' : 'Using your configured model API.'}</p></div><span className="coming-pill">{mode === 'demo' ? 'DEMO' : 'CONNECTED'}</span></div><div className="settings-coming"><Sparkles size={22} /><h3>A few more things are on the way.</h3><p>Settings is a preview for now. The good stuff is in your queries.</p></div></section></div>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState('');
  const [path, setPath] = useState(location.pathname);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('demo');
  const [selected, setSelected] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  function navigate(next) { history.pushState({}, '', next); setPath(next); setMobileOpen(false); setProfileOpen(false); setHelpOpen(false); setNotificationsOpen(false); window.scrollTo(0, 0); }
  function expired() { setSession(null); setQueries([]); setSelected(null); setNotice('Your one-hour session has ended. Sign in to pick up where you left off.'); history.replaceState({}, '', '/login'); setPath('/login'); }
  useEffect(() => {
    api('/auth/me').then(setSession).catch(() => {}).finally(() => setChecking(false));
    const pop = () => setPath(location.pathname);
    window.addEventListener('popstate', pop); window.addEventListener('session-expired', expired);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('session-expired', expired); };
  }, []);
  useEffect(() => {
    if (!profileOpen) return;
    const close = e => { if (!profileRef.current?.contains(e.target)) setProfileOpen(false); };
    const escape = e => { if (e.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);
  async function loadQueries() { setLoading(true); setError(''); try { const data = await api('/queries'); setQueries(data.queries); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { if (session) { loadQueries(); api('/config').then(data => setMode(data.model_mode)).catch(() => {}); const timeout = setTimeout(expired, Math.max(0, new Date(session.expires_at) - Date.now())); return () => clearTimeout(timeout); } }, [session?.user.id]);
  function loggedIn(data) { setSession(data); setNotice(''); navigate('/'); }
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); setSession(null); setQueries([]); setSelected(null); navigate('/login'); } catch (e) { setNotice(e.message); } }
  if (checking) return <div className="app-loader"><Logo /><LoaderCircle size={25} className="spin" /></div>;
  if (!session) return <Auth onLogin={loggedIn} notice={notice} />;
  const isQuery = path === '/query'; const isSettings = path === '/settings';
  return <div className="app-shell">
    {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}><Logo light /><div className="workspace-label">PERSONAL WORKSPACE</div><nav><button className={!isQuery && !isSettings ? 'active' : ''} onClick={() => navigate('/')}><LayoutGrid size={18} />My queries<span className="nav-count">{queries.length}</span></button><button className={isQuery ? 'active' : ''} onClick={() => navigate('/query')}><FileSearch size={18} />Query{isQuery && <span className="nav-current" />}</button></nav><div className="sidebar-divider" /><div className="sidebar-caption"><span className="sidebar-caption-line" /><p>A little insight.<br /><span>A better next move.</span></p></div><div className="sidebar-bottom"><div className="private-workspace"><span className="private-icon"><LockKeyhole size={17} /></span><h4>Just your business.</h4><p>Your queries are private.<br />Your next move is yours.</p><span><span /> Personal workspace</span></div><button className="help-button" onClick={() => setHelpOpen(!helpOpen)}><HelpCircle size={17} />A little guidance<ArrowUpRight size={14} /></button><div ref={profileRef} className="profile-container">{profileOpen && <div className="profile-menu"><span className="profile-menu-label">YOUR ACCOUNT</span><button onClick={() => navigate('/settings')}><Settings size={16} />Settings<ArrowUpRight size={14} /></button><button onClick={logout}><LogOut size={16} />Sign out</button><div><Clock3 size={12} />Session expires in 1 hour from sign-in</div></div>}<button className={`profile-button ${profileOpen ? 'open' : ''}`} onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} aria-label="Open profile menu"><Avatar user={session.user} /><span><strong>{session.user.name}</strong><span>{session.user.is_demo ? 'Demo workspace' : 'Personal account'}</span></span><ChevronDown size={15} /></button></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={12} /><strong>{isSettings ? 'Settings' : isQuery ? 'Query' : 'My queries'}</strong></div><div className="topbar-right"><span className="today">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="topbar-divider" /><div className="notifications-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /></button>{notificationsOpen && <div className="notifications-menu"><h4>You’re all caught up.</h4><p>New analyses are saved directly to My queries.</p></div>}</div><Avatar user={session.user} small /></div></header>
      <main className="main-content">{notice && <ErrorBox>{notice}</ErrorBox>}{isSettings ? <SettingsPage user={session.user} session={session} mode={mode} /> : isQuery ? <QueryPage mode={mode} navigate={navigate} onView={setSelected} onCreated={q => setQueries(previous => [q, ...previous])} /> : <QueriesPage user={session.user} queries={queries} loading={loading} error={error} onRetry={loadQueries} navigate={navigate} onView={setSelected} mode={mode} />}</main>
    </div>{selected && <Detail query={selected} onClose={() => setSelected(null)} />}
    {helpOpen && <div className="help-popover"><button className="icon-button" aria-label="Close guidance" onClick={() => setHelpOpen(false)}><X size={17} /></button><span className="square-icon purple"><HelpCircle size={21} /></span><h3>A little guidance.</h3><p>Paste a Facebook Marketplace vehicle link in Query. Open any saved analysis in My queries to review its photos, details, and signals.</p><p>{mode === 'demo' ? 'Demo mode uses sample data. It does not fetch or assess real listings.' : 'Predictions come from the connected model API.'}</p><button className="button primary" onClick={() => navigate('/query')}>Check a listing<ArrowRight size={15} /></button></div>}
  </div>;
}
