/* =========================================================
   Counterwebsite – 2025 design helpers
   - CountUp on view with IntersectionObserver
   - Dark/Light mode toggle (respects prefers-color-scheme)
   - Accessible mobile nav
   - Optional dynamic data fetch (see fetchCounters example)
   ========================================================= */

document.documentElement.classList.remove('no-js');

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

/* YEAR */
$('#yearNow').textContent = new Date().getFullYear();

/* THEME */
const themeKey = 'pref-theme';
function getPrefTheme(){
  const saved = localStorage.getItem(themeKey);
  if(saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(t){
  if(t === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
}
let currentTheme = getPrefTheme();
applyTheme(currentTheme);

$('#themeToggle')?.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem(themeKey, currentTheme);
  applyTheme(currentTheme);
});

/* NAV mobile */
const navToggle = $('.nav-toggle');
const navList = $('#nav-list');
navToggle?.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

/* Submenu (mobile accessibility) */
$$('.has-sub .sub-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const ul = btn.parentElement.querySelector('.sub');
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    ul.classList.toggle('open');
  });
});

/* COUNTERS – animate on view */
function initCounters(dataMap){
  // dataMap optionally overrides targets, e.g. {0: 12345, 1: 600, ...}
  const counters = $$('.counter');

  const observer = new IntersectionObserver((entries) => {
    for(const entry of entries){
      if(entry.isIntersecting){
        const el = entry.target;
        const index = counters.indexOf(el);
        const rawTarget = dataMap?.[index] ?? Number(el.dataset.target || el.textContent.replace(/\D/g,''));
        const duration = Number(el.dataset.duration || 2.5);

        // If reduced motion: set immediately
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches){
          el.textContent = new Intl.NumberFormat('nl-NL').format(rawTarget);
          observer.unobserve(el);
          continue;
        }

        // CountUp
        const cu = new window.CountUp.CountUp(el, rawTarget, {
          duration,
          separator: '.'
        });

        // For screen readers: announce final number once (not every tick)
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');

        if(!cu.error){ cu.start(() => {
          el.setAttribute('aria-label', new Intl.NumberFormat('nl-NL').format(rawTarget));
        }); }
        observer.unobserve(el);
      }
    }
  }, { threshold: 0.35 });

  counters.forEach(c => observer.observe(c));
}

/* OPTIONAL: dynamic counters via JSON
   - Place counters.json at /data/counters.json
   - {
       "helped": 12034,
       "volunteers": 540,
       "applications": 27980,
       "partners": 78
     }
*/
async function fetchCounters(){
  try{
    const res = await fetch('data/counters.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    // Map to indexes of the four counters in DOM:
    // 0 helped, 1 volunteers, 2 applications, 3 partners
    return {
      0: Number(json.helped ?? 10000),
      1: Number(json.volunteers ?? 500),
      2: Number(json.applications ?? 26500),
      3: Number(json.partners ?? 72),
    };
  }catch(e){
    // Fallback to static data
    return null;
  }
}

(async function boot(){
  // Smooth start
  try{
    const map = await fetchCounters();
    initCounters(map || undefined);
  }catch(_){
    initCounters();
  }
})();