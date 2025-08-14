/* assets/js/app.js */
'use strict';

/* ===== Helpers ===== */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const safeParse = (raw, fallback) => { try { const v = JSON.parse(raw); return v ?? fallback; } catch { return fallback; } };
const asArray   = (v) => Array.isArray(v) ? v : [];
const SAR       = new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'});

/* ===== Supabase =====
   - نتوقع أنك عرّفت في index.html:
     window.SB_URL, window.SB_ANON  + سكربت supabase-js@2
   - لو ما كانت موجودة، سنحاول إنشاء العميل من المتوفر. */
(function ensureSupabaseClient(){
  try{
    if(!window.sb){
      if(!window.SB_URL || !window.SB_ANON || !window.supabase){
        console.warn('Supabase config/scripts missing. Define window.SB_URL/SB_ANON and include supabase-js.');
      }else{
        window.sb = window.supabase.createClient(window.SB_URL, window.SB_ANON);
      }
    }
    if(window.sb) console.log('Supabase ready');
  }catch(e){ console.error('Supabase init error', e); }
})();

/* ===== بيانات المنتجات =====
   ملاحظة: إن كان لديك مصفوفة PRODUCTS مخصّصة (بمسارات صورك)،
   اتركها معرّفة عالميًا كـ window.PRODUCTS قبل هذا الملف.
   سيستخدم الكود القائمة العالمية، وإلا سيستعمل هذه القائمة الافتراضية. */
const PRODUCTS = (typeof window !== 'undefined' && Array.isArray(window.PRODUCTS)) ? window.PRODUCTS : [
  {id:'p1', name:'سامسونج S25 ألترا',  price:4699, was:5299, cat:'جوالات', best:true, rec:true, img:'images/s25.jpg', desc:'هاتف رائد بأداء قوي وبطارية تدوم طويلًا.', specs:['شاشة 6.8"','256GB','كاميرا 200MP']},
  {id:'p2', name:'آيفون 16 برو ماكس', price:5499, was:5999, cat:'جوالات', new:true,  rec:true, img:'images/iphone16pm.jpg', desc:'تجربة iOS مع تصميم فخم وأداء سلس.', specs:['شاشة 6.7"','A18','ProMotion']},
  {id:'p3', name:'ساعة ذكية سبورت',   price:699,  was:899,  cat:'ساعات',  best:true,           img:'images/sport-watch.jpg', desc:'تعقّب صحي متكامل مع بطارية ممتازة.', specs:['مقاومة للماء','GPS','مراقبة نبض']},
  {id:'p4', name:'سماعات لاسلكية',     price:399,  was:549,  cat:'سماعات', new:true,           img:'images/earbuds.jpg', desc:'صوت نقي وتصميم مريح.', specs:['ANC','Bluetooth','شحن سريع']},
  {id:'p5', name:'شاحن سريع 45W',      price:119,  was:149,  cat:'اكسسوارات',           rec:true, img:'images/charger-45w.jpg', desc:'شحن آمن وسريع متوافق مع أغلب الأجهزة.', specs:['USB-C','PD']},
  {id:'p6', name:'سماعات رأس',         price:249,  was:349,  cat:'سماعات',           best:true, img:'images/headset.jpg', desc:'خيار اقتصادي بصوت قوي ومتوازن.', specs:['Bass','ميكروفون']}
];

const PROMOS = ['خصم %35','شحن مجاني','كوبونات','عروض اليوم'];
const MOOD   = ['مزاج اليوم: هادي 😌','كود HOMEY10 فعّال','توصيل سريع','منتج موصى به','أسعار مخفّضة','زجاج & لمعة ✨'];

/* ===== State ===== */
const state = {
  q:'', cat:'الكل', min:0, max:99999, sort:'popular',
  fav:new Set(asArray(safeParse(localStorage.getItem('homey:fav')||'[]', []))),
  cart:safeParse(localStorage.getItem('homey:cart')||'{}', {}),
  user:safeParse(localStorage.getItem('homey:user')||'null', null),
  tab:'all',
  discount:0,
  open:null
};

/* ===== عناصر DOM ===== */
const $grid = $('#grid');
const $empty = $('#empty');
const $stories = $('#stories');
const $mood = $('#mood');
const $capsules = $('#capsules');
const $search = $('#search');
const $cat = $('#filter-cat');
const $min = $('#min');
const $max = $('#max');
const $sort = $('#sort');
const $reset = $('#reset');
const $favPill = $('#fav-pill');

const $overlay = $('#overlay');
const $dlgTitle = $('#dlg-title');
const $dlgImg = $('#dlg-img');
const $dlgPrice = $('#dlg-price');
const $dlgWas = $('#dlg-was');
const $dlgDesc = $('#dlg-desc');
const $dlgSpecs = $('#dlg-specs');
const $dlgAdd = $('#dlg-add');
const $dlgFav = $('#dlg-fav');

const $cartBackdrop = $('#cart-backdrop');
const $cartItems = $('#cart-items');
const $cartTotal = $('#cart-total');
const $cartDiscount = $('#cart-discount');
const $cartCount = $('#cart-count');
const $coupon = $('#coupon');
const $applyCoupon = $('#apply-coupon');

const $btnCart = $('#btn-cart');
const $btnFav = $('#btn-fav');
const $btnAuth = $('#btn-auth');

const $acctBackdrop = $('#acct-backdrop');
const $toast = $('#toast');

/* ===== ثيم محفوظ + مبدّل ألوان ===== */
(function initTheme(){
  const saved = localStorage.getItem('homey:theme');
  if(saved) document.documentElement.setAttribute('data-theme', saved);
  $$('.swatch').forEach(s=>s?.addEventListener('click', ()=>{
    const t=s.dataset.t; document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('homey:theme', t);
  }));
})();

/* ===== Placeholder SVG عند فقدان الصورة ===== */
const placeholder = (cat='منتج')=>{
  const label = String(cat||'منتج').slice(0,12);
  const svg =
`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#d1fae5'/><stop offset='100%' stop-color='#a7f3d0'/></linearGradient></defs>
  <rect width='100%' height='100%' fill='url(#g)'/>
  <g fill='none' stroke='#065f46' stroke-width='12' stroke-linecap='round' stroke-linejoin='round' transform='translate(150,180) scale(1.2)'><path d='M3 120l147-110 147 110'/><path d='M120 300V170h60v130'/></g>
  <text x='50%' y='88%' text-anchor='middle' font-size='42' font-family='system-ui' fill='#065f46'>${label}</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

const productImgSrc = p => (p && p.img && String(p.img).trim()) ? p.img : placeholder(p?.cat);

/* ===== فئات ===== */
const computeCats = () => {
  try{
    const catList = asArray(PRODUCTS).map(p=>p && p.cat).filter(Boolean);
    return ['الكل', ...Array.from(new Set(catList))];
  }catch(e){ console.error(e); return ['الكل'];}
};
let CATS = computeCats();
const renderCatOptions = (list) => { if($cat) $cat.innerHTML = asArray(list).map(c=>`<option>${c}</option>`).join(''); };
renderCatOptions(CATS);

/* ===== قصص ومزاج اليوم ===== */
if($stories) $stories.innerHTML = PROMOS.map(p=>`<div class="glass story">${p}</div>`).join('');
if($mood)    $mood.innerHTML    = MOOD.map(m=>`<span class="chip">${m}</span>`).join('');

/* ===== كبسولات فئات (لوحات) ===== */
const CAPS = [
  {cat:'جوالات', text:'أحدث الهواتف', sub:'اختيارات أنيقة وسريعة', icon:`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0b0b0b" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>`},
  {cat:'ساعات', text:'ساعات ذكية', sub:'للياقة والأسلوب', icon:`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0b0b0b" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 9v4l2 2"/><rect x="9" y="1" width="6" height="4" rx="1"/><rect x="9" y="19" width="6" height="4" rx="1"/></svg>`},
  {cat:'سماعات', text:'صوت نقي', sub:'لاسلكي ومريح', icon:`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0b0b0b" stroke-width="2"><path d="M3 10a9 9 0 0 1 18 0"/><rect x="3" y="10" width="4" height="10" rx="2"/><rect x="17" y="10" width="4" height="10" rx="2"/></svg>`},
  {cat:'اكسسوارات', text:'إكسسوارات', sub:'شواحن وكوابل', icon:`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0b0b0b" stroke-width="2"><path d="M7 7h10v10H7z"/><path d="M3 10h4M17 10h4M10 3v4M14 3v4M10 17v4M14 17v4"/></svg>`},
];
function renderCapsules(){
  if(!$capsules) return;
  const html = CAPS.map(c=>`
    <div class="glass capsule reveal">
      <div class="ico" aria-hidden="true">${c.icon}</div>
      <div>
        <h3>${c.text}</h3>
        <p>${c.sub}</p>
      </div>
      <a href="#" data-cap="${c.cat}" class="chip">تسوّق الآن</a>
    </div>
  `).join('');
  $capsules.innerHTML = html;
  $$('[data-cap]').forEach(a=>a.addEventListener('click', e=>{
    e.preventDefault();
    state.cat = a.dataset.cap; if($cat){ $cat.value = state.cat; } render();
    window.scrollTo({top: 0, behavior:'smooth'});
  }));
}
renderCapsules();

/* ===== Skeleton ===== */
const makeSkeleton = () => `
  <article class="glass card" aria-hidden="true">
    <div class="skeleton" style="aspect-ratio:1/1; border-radius:12px"></div>
    <div class="skeleton" style="height:16px; border-radius:8px; margin-top:.5rem"></div>
    <div class="skeleton" style="height:12px; width:60%; border-radius:8px"></div>
    <div class="skeleton" style="height:36px; border-radius:10px; margin-top:.4rem"></div>
  </article>`;
function renderSkeletons(n=8){
  if(!$grid) return;
  $grid.innerHTML = new Array(n).fill(0).map(makeSkeleton).join('');
  if($empty) $empty.hidden = true;
}

/* ===== بناء الكروت ===== */
function buildCard(p){
  const badge = p.was ? `<span class="badge-corner">خصم</span>` :
                p.new ? `<span class="badge-corner">جديد</span>` :
                p.best? `<span class="badge-corner">الأكثر مبيعًا</span>` :
                p.rec ? `<span class="badge-corner">موصى به</span>` : '';
  return `
  <article class="glass card reveal">
    ${badge}
    <button class="btn-ghost fav" aria-label="المفضلة" data-fav="${p.id}">
      <svg class="icon" viewBox="0 0 24 24" fill="${state.fav.has(p.id)?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-8.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
    </button>
    <a href="#" data-open="${p.id}">
      <img loading="lazy" decoding="async" src="${productImgSrc(p)}"
           data-fallback="${placeholder(p.cat)}"
           onerror="this.onerror=null; this.src=this.dataset.fallback"
           alt="${p.name}"
           style="aspect-ratio:1/1; object-fit:cover; border-radius:12px; background:color-mix(in oklab, var(--green), white 92%)">
    </a>
    <div style="display:grid; gap:.3rem">
      <strong style="font-size:.95rem">${p.name}</strong>
      <div class="price"><span style="font-weight:800">${SAR.format(p.price)}</span> ${p.was?`<s>${SAR.format(p.was)}</s>`:''}</div>
    </div>
    <button class="btn" data-add="${p.id}">أضِف للسلة</button>
  </article>`;
}

function filterByTab(xs){
  if(state.tab==='bests') return xs.filter(p=>p.best);
  if(state.tab==='new')  return xs.filter(p=>p.new);
  if(state.tab==='rec')  return xs.filter(p=>p.rec);
  return xs;
}

/* ===== رندر الشبكة ===== */
function render(){
  renderSkeletons(6);
  requestAnimationFrame(()=>{
    let xs = asArray(PRODUCTS).filter(p => (
      (!state.q || (p.name + (p.desc||'') + ((p.tags||[]).join(' '))).includes(state.q)) &&
      (state.cat==='الكل' || state.cat==='❤ المفضلة' || p.cat===state.cat) &&
      p.price>=state.min && p.price<=state.max
    ));
    if(state.cat==='❤ المفضلة') xs = xs.filter(p => state.fav.has(p.id));
    xs = filterByTab(xs);
    if(state.sort==='price-asc')  xs.sort((a,b)=>a.price-b.price);
    if(state.sort==='price-desc') xs.sort((a,b)=>b.price-a.price);
    if(state.sort==='alpha')      xs.sort((a,b)=>a.name.localeCompare(b.name,'ar'));

    if(!xs.length){ if($grid) $grid.innerHTML=''; if($empty) $empty.hidden=false; return; }
    if($empty) $empty.hidden = true;
    if($grid){
      $grid.innerHTML = xs.map(buildCard).join('');
      bindGrid();
      updateCartBadge();
      revealWatch();
    }
  });
}

function bindGrid(){
  $$('#grid [data-open]').forEach(el=>el.addEventListener('click', e=>{ e.preventDefault(); openDialog(el.dataset.open); }));
  $$('#grid [data-add]').forEach(el=>el.addEventListener('click', ()=>{ addToCart(el.dataset.add); toast('تمت الإضافة للسلة'); }));
  $$('#grid [data-fav]').forEach(el=>el.addEventListener('click', ()=>{ toggleFav(el.dataset.fav); }));
}

/* ===== البحث والفلاتر ===== */
let timer;
$search?.addEventListener('input', e=>{ clearTimeout(timer); timer=setTimeout(()=>{ state.q=e.target.value.trim(); render(); }, 250); });
$cat?.addEventListener('change', e=>{ state.cat=e.target.value; render(); });
$min?.addEventListener('change', e=>{ state.min=Number(e.target.value||0); render(); });
$max?.addEventListener('change', e=>{ state.max=Number(e.target.value||99999); render(); });
$sort?.addEventListener('change', e=>{ state.sort=e.target.value; render(); });
$reset?.addEventListener('click', ()=>{
  state.q=''; if($search) $search.value='';
  state.cat='الكل'; renderCatOptions(CATS = computeCats()); if($cat) $cat.value='الكل';
  state.min=0; if($min) $min.value=''; state.max=99999; if($max) $max.value='';
  state.sort='popular'; if($sort) $sort.value='popular'; render();
});

/* تبويبات */
$$('.tab').forEach(t=>t.addEventListener('click', ()=>{
  $$('.tab').forEach(x=>x.setAttribute('aria-selected','false'));
  t.setAttribute('aria-selected','true');
  state.tab = t.dataset.tab;
  render();
}));

/* ===== المفضلة ===== */
function toggleFav(id){ state.fav.has(id)? state.fav.delete(id): state.fav.add(id); persist(); if($favPill) $favPill.style.display = (state.cat==='❤ المفضلة')?'inline-block':'none'; render(); }
$btnFav?.addEventListener('click', ()=>{
  if(state.cat!=="❤ المفضلة"){
    state.cat = "❤ المفضلة"; renderCatOptions(["❤ المفضلة", ...CATS]); if($cat) $cat.value = '❤ المفضلة'; if($favPill) $favPill.style.display='inline-block';
  } else {
    renderCatOptions(CATS); if($cat) $cat.value='الكل'; state.cat='الكل'; if($favPill) $favPill.style.display='none';
  }
  render();
});

/* ===== السلة ===== */
function addToCart(id){ state.cart[id] = (state.cart[id]||0)+1; persist(); updateCartBadge(); }
function decFromCart(id){ if(!state.cart[id]) return; state.cart[id]--; if(state.cart[id]<=0) delete state.cart[id]; persist(); renderCart(); updateCartBadge(); }
function removeFromCart(id){ delete state.cart[id]; persist(); renderCart(); updateCartBadge(); }
const cartSubtotal = ()=> Object.entries(state.cart).reduce((sum,[id,qty])=>{ const p = PRODUCTS.find(x=>x.id===id); return sum + (p?p.price*qty:0) },0);
function updateCartBadge(){ const count = Object.values(state.cart).reduce((a,b)=>a+b,0); if($cartCount) $cartCount.textContent = count; }

function renderCart(){
  const entries = Object.entries(state.cart || {});
  if(!entries.length){
    $cartItems.innerHTML = `<div class="empty glass">السلة فارغة.</div>`;
    $cartDiscount.textContent = SAR.format(0);
    $cartTotal.textContent = SAR.format(0);
    return;
  }
  $cartItems.innerHTML = entries.map(([id,qty])=>{
    const p = PRODUCTS.find(x=>x.id===id); if(!p) return '';
    return `
      <div class="glass" style="padding:10px; display:grid; grid-template-columns:64px 1fr auto; gap:.6rem; align-items:center">
        <img loading="lazy" decoding="async" src="${productImgSrc(p)}" data-fallback="${placeholder(p.cat)}"
             onerror="this.onerror=null; this.src=this.dataset.fallback"
             alt="" style="width:64px; height:64px; object-fit:cover; border-radius:12px; background:color-mix(in oklab, var(--green), white 92%)">
        <div>
          <div style="font-weight:700">${p.name}</div>
          <div>${SAR.format(p.price)} × ${qty}</div>
        </div>
        <div style="display:grid; gap:6px">
          <div style="display:flex; gap:6px">
            <button class="chip" data-dec="${id}">−</button>
            <button class="chip" data-inc="${id}">+</button>
          </div>
          <button class="chip" data-del="${id}" style="background:#ffe8e8">حذف</button>
        </div>
      </div>`;
  }).join('');
  const sub = cartSubtotal();
  const disc = state.discount ? Math.min(state.discount, sub) : 0;
  $cartDiscount.textContent = SAR.format(disc);
  $cartTotal.textContent = SAR.format(Math.max(0, sub - disc));
  $$('#cart-items [data-inc]').forEach(b=>b.addEventListener('click',()=>{ addToCart(b.dataset.inc); renderCart(); }));
  $$('#cart-items [data-dec]').forEach(b=>b.addEventListener('click',()=>{ decFromCart(b.dataset.dec); }));
  $$('#cart-items [data-del]').forEach(b=>b.addEventListener('click',()=>{ removeFromCart(b.dataset.del); }));
}

$applyCoupon?.addEventListener('click', ()=>{
  const code = ($coupon.value||'').trim().toUpperCase();
  if(!code) return toast('أدخل كود خصم');
  if(code==='HOMEY10'){ state.discount = 10; toast('تم تطبيق خصم 10 ر.س'); }
  else { state.discount = 0; toast('الكود غير صالح'); }
  renderCart();
});

$('#cart-close')?.addEventListener('click', ()=> hideModal($cartBackdrop));
$btnCart?.addEventListener('click', ()=>{ showModal($cartBackdrop, $('#cart-close')); renderCart(); });
$cartBackdrop?.addEventListener('click', e=>{ if(e.target===$cartBackdrop) hideModal($cartBackdrop); });
enableSwipeToClose($cartBackdrop);

/* ===== تسجيل الدخول/الحساب ===== */
// زر الدخول الآن يفتح صفحة auth.html بدل المودال القديم
$btnAuth?.addEventListener('click', ()=>{
  if(state.user){
    showModal($acctBackdrop, $('#acct-close'));
    renderMyOrders(); // اعرض طلباتي عند فتح الحساب
  } else {
    location.href = 'auth.html';
  }
});

$acctBackdrop?.addEventListener('click', e=>{ if(e.target===$acctBackdrop) hideModal($acctBackdrop); });
enableSwipeToClose($acctBackdrop);
$('#acct-close')?.addEventListener('click', ()=> hideModal($acctBackdrop));
$('#logout')?.addEventListener('click', async ()=>{
  try{ await window.sb?.auth?.signOut(); }catch{}
  state.user=null; localStorage.removeItem('homey:user'); hideModal($acctBackdrop); toast('تم تسجيل الخروج');
});

/* ===== “طلباتي” داخل مودال الحساب ===== */
async function renderMyOrders(){
  if(!state.user || !window.sb) return;
  const host = $('#acct-body'); if(!host) return;

  let box = host.querySelector('[data-myorders]');
  if(!box){
    box = document.createElement('div');
    box.className = 'glass';
    box.setAttribute('data-myorders','');
    box.style.padding = '.6rem';
    host.prepend(box);
  }
  box.innerHTML = `<strong>طلباتي</strong><div id="myorders-list" style="margin-top:.4rem; color:var(--ink-2)">جارٍ التحميل…</div>`;

  const { data: orders, error } = await sb.from('orders')
    .select('id,total,discount,status,created_at,coupon_code')
    .eq('user_id', state.user.id)
    .order('created_at',{ascending:false});

  const list = box.querySelector('#myorders-list');
  if(error){ list.textContent = 'تعذّر تحميل الطلبات'; return; }
  if(!orders?.length){ list.textContent = 'لا توجد طلبات بعد.'; return; }

  list.innerHTML = orders.map(o=>{
    const total = (o.total||0)-(o.discount||0);
    return `<div class="glass" style="padding:.5rem; margin:.4rem 0; display:grid; gap:.5rem">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>#${o.id.slice(0,8)} • ${new Date(o.created_at).toLocaleString('ar-SA')}</div>
        <div><span class="chip">${o.status}</span> — <strong>${SAR.format(total)}</strong></div>
      </div>
      ${o.coupon_code ? `<div class="muted">كوبون: ${o.coupon_code}</div>`:''}
    </div>`;
  }).join('');
}

/* ===== تأكيد الطلب (كاش) ===== */
$('#checkout')?.addEventListener('click', async ()=>{
  if(!Object.keys(state.cart||{}).length){ toast('السلة فارغة'); return; }

  // لو مش مسجّل → روح auth.html
  if(!state.user){
    toast('سجّل الدخول أولًا');
    setTimeout(()=> location.href='auth.html', 400);
    return;
  }

  // إجمالي + إنشاء order + order_items
  try{
    const subtotal = cartSubtotal();
    const discount = Math.min(state.discount||0, subtotal);
    const total    = subtotal; // نخزن الإجمالي قبل الخصم (اختيار تصميم)
    const userId   = state.user.id;

    // upsert profile احتياطًا
    try{ await sb.from('profiles').upsert({ id:userId, email: state.user.email }).select(); }catch{}

    const { data: order, error: e1 } = await sb.from('orders')
      .insert({
        user_id: userId,
        total, discount,
        payment_method: 'cod',
        status: 'pending',
        coupon_code: ($coupon?.value||'').trim() || null
      })
      .select()
      .single();
    if(e1){ console.error(e1); toast('تعذّر إنشاء الطلب'); return; }

    const rows = Object.entries(state.cart).map(([id,qty])=>{
      const p = PRODUCTS.find(x=>x.id===id);
      return { order_id: order.id, product_id: id, product_name: p?.name || id, price: p?.price||0, qty };
    });

    const { error: e2 } = await sb.from('order_items').insert(rows);
    if(e2){ console.error(e2); toast('تعذّر حفظ الأصناف'); return; }

    toast('تم تأكيد الطلب — سيتم الدفع عند الاستلام');
    state.cart = {}; state.discount=0; persist(); renderCart(); updateCartBadge(); hideModal($cartBackdrop);
  }catch(err){
    console.error(err); toast('حدث خطأ أثناء تأكيد الطلب');
  }
});

/* ===== مودال تفاصيل المنتج ===== */
function openDialog(id){
  const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
  state.open = id;
  $dlgTitle.textContent = p.name;
  $dlgImg.loading = 'lazy'; $dlgImg.decoding='async';
  $dlgImg.src = productImgSrc(p);
  $dlgImg.dataset.fallback = placeholder(p.cat);
  $dlgImg.onerror = function(){ this.onerror=null; this.src=this.dataset.fallback; };
  $dlgImg.alt = p.name;
  $dlgPrice.textContent = SAR.format(p.price);
  $dlgWas.textContent = p.was? SAR.format(p.was) : '';
  $dlgDesc.textContent = p.desc || '';
  $dlgSpecs.innerHTML = (p.specs||[]).map(s=>`<span class="chip">${s}</span>`).join('');
  $dlgFav.textContent = state.fav.has(id)? 'مفضلة' : 'أضف للمفضلة';
  showModal($overlay, $('#dlg-close'));
}
function closeDialog(){ hideModal($overlay); state.open=null; }
$('#dlg-close')?.addEventListener('click', closeDialog);
$overlay?.addEventListener('click', e=>{ if(e.target===$overlay) closeDialog(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ [ $overlay,$cartBackdrop,$acctBackdrop ].forEach(hideModal); } });
$dlgAdd?.addEventListener('click', ()=>{ if(!state.open) return; addToCart(state.open); toast('تمت الإضافة للسلة'); });
$dlgFav?.addEventListener('click', ()=>{ if(!state.open) return; toggleFav(state.open); $dlgFav.textContent = state.fav.has(state.open)? 'مفضلة' : 'أضف للمفضلة'; });

/* ===== Toast ===== */
function toast(msg){ if(!$toast) return; $toast.textContent = msg; $toast.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>{ $toast.classList.remove('show'); }, 1600); }

/* ===== تخزين محلي ===== */
function persist(){
  localStorage.setItem('homey:cart', JSON.stringify(state.cart||{}));
  localStorage.setItem('homey:fav', JSON.stringify([...state.fav]));
  if(state.user) localStorage.setItem('homey:user', JSON.stringify(state.user));
}

/* ===== وصولية: trap focus للمودالات ===== */
let lastFocused=null;
function focusables(root){ return $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(el=>!el.hasAttribute('disabled')); }
function trapKey(e,root){
  if(e.key!=='Tab') return;
  const f = focusables(root); if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ last.focus(); e.preventDefault(); }
  else if(!e.shiftKey && document.activeElement===last){ first.focus(); e.preventDefault(); }
}
function showModal(overlay, firstFocusBtn){
  if(!overlay || overlay.classList.contains('show')) return;
  lastFocused = document.activeElement;
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  overlay.addEventListener('keydown', modalKeyHandler);
  (firstFocusBtn||focusables(overlay)[0])?.focus();
}
function hideModal(overlay){
  if(!overlay || !overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  overlay.removeEventListener('keydown', modalKeyHandler);
  lastFocused?.focus();
}
function modalKeyHandler(e){
  const root = e.currentTarget.querySelector('[role="document"], form') || e.currentTarget;
  trapKey(e, root);
}

/* سحب لإغلاق على الجوال */
function enableSwipeToClose(overlay){
  if(!overlay) return;
  let startY=null, moved=false;
  overlay.addEventListener('pointerdown', e=>{ if(e.target!==overlay) return; startY=e.clientY; moved=false; });
  overlay.addEventListener('pointermove', e=>{ if(startY===null) return; if(Math.abs(e.clientY-startY)>14) moved=true; });
  overlay.addEventListener('pointerup', e=>{ if(startY===null) return; const dy=e.clientY-startY; if(moved && dy>40) hideModal(overlay); startY=null; moved=false; });
}

/* ===== دخول العناصر عند التمرير (Reveal) ===== */
let io;
function revealWatch(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) { $$('.reveal').forEach(el=>el.classList.add('in')); return; }
  if(io){ io.disconnect(); }
  io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
    });
  },{rootMargin:'-10% 0px -10% 0px'});
  $$('.reveal').forEach(el=>io.observe(el));
}

/* ===== جلسة Supabase عند التحميل ===== */
(async function initSession(){
  if(!window.sb){ render(); revealWatch(); return; }
  try{
    const { data:{ user } } = await sb.auth.getUser();
    if(user){
      state.user = { id:user.id, email:user.email };
      try{ await sb.from('profiles').upsert({ id:user.id, email:user.email }).select(); }catch{}
      localStorage.setItem('homey:user', JSON.stringify(state.user));
    }else{
      state.user = null; localStorage.removeItem('homey:user');
    }
  }catch(e){ console.warn('auth.getUser error', e); }
  render(); revealWatch();
})();

/* ===== اختبارات بسيطة ===== */
(function runTests(){
  const CATS = computeCats();
  console.log('✅ CATS مصفوفة:', Array.isArray(CATS));
  console.log('✅ CATS تحتوي "الكل":', CATS.includes('الكل'));
  const old=state.cart; state.cart={}; console.log('✅ cartSubtotal على سلة فارغة = 0:', cartSubtotal()===0); state.cart=old;
})();

/* ===== تحسينات واجهة: ظلّ الهيدر + Ripple + مؤشر التبويبات (نسخة آمنة) ===== */
;(() => {
  try {
    // 1) ظلّ الهيدر عند التمرير
    const header = document.querySelector('.header');
    if (header) {
      const setShadow = () => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        header.classList.toggle('scrolled', y > 8);
      };
      setShadow();
      window.addEventListener('scroll', setShadow, { passive: true });
    }

    // 2) Ripple لكل الأزرار/الشرائح
    document.addEventListener('click', (e) => {
      const el = e.target.closest('.btn, .btn-ghost, .chip');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.2;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top  = `${e.clientY - rect.top  - size / 2}px`;
      el.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    });

    // 2.1) نبضة صغيرة لأيقونة المفضلة
    document.addEventListener('click', (e) => {
      const fav = e.target.closest('.fav');
      if (!fav) return;
      fav.classList.add('bounce');
      setTimeout(() => fav.classList.remove('bounce'), 220);
    });

    // 3) مؤشر التبويبات السفلي (يتحرّك تحت التاب المختار)
    const tabs = document.querySelector('.tabs');
    if (tabs) {
      let indicator = tabs.querySelector('.indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'indicator';
        tabs.appendChild(indicator);
      }

      const updateIndicator = () => {
        const active =
          tabs.querySelector('.tab[aria-selected="true"]') ||
          tabs.querySelector('.tab');
        if (!active) return;
        const aRect = active.getBoundingClientRect();
        const tRect = tabs.getBoundingClientRect();
        indicator.style.width = `${aRect.width}px`;
        indicator.style.transform = `translateX(${aRect.left - tRect.left}px)`;
      };

      updateIndicator();
      window.addEventListener('resize', updateIndicator);
      tabs.addEventListener('click', (e) => {
        if (e.target.closest('.tab')) setTimeout(updateIndicator, 0);
      });
    }
  } catch (err) {
    console.error('UI niceties block failed (ignored):', err);
  }

  // في حال تعطّل الرندر قبل كده لأي سبب، نجرب نستدعيه بأمان:
  try { typeof render === 'function' && render(); } catch {}
})();
