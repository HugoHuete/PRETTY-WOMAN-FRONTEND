const now=new Date();
const todayISO=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
const todayLabel=now.toLocaleDateString('es-NI',{day:'numeric',month:'short',year:'numeric'}).replace('.','');
const sales = [
  { id:'V-0128', time:'10:18 a. m.', date:todayLabel, dateISO:todayISO, type:'reservation', typeLabel:'Reserva', channel:'WhatsApp', comments:'Separar ambas prendas para retiro por la tarde.', client:{name:'Ana Martínez',phone:'+505 8888 2200'}, total:2050, discount:90, payment:'partial', paid:1000, shippingPaid:0, delivery:'none', paymentMovements:[{id:'P-0431',recordedAt:'Hoy · 10:24 a. m.',method:'Transferencia',currency:'USD',productAmount:1000,shippingAmount:0,amountReceivedUsd:27.31,exchangeRate:36.62,changeGivenNio:0}], products:[{name:'Vestido satinado',variant:'Coral · Talla S',price:1250,image:'../../assets/catalog/coral-satin-dress.png'},{name:'Blusa seda',variant:'Champán · Talla M',price:800,image:'../../assets/catalog/blouse-champagne.png'}] },
  { id:'V-0127', time:'9:46 a. m.', date:todayLabel, dateISO:todayISO, type:'sale', typeLabel:'Venta', channel:'Tienda física', comments:'', client:null, total:1780, discount:0, payment:'paid', paid:1780, delivery:'not-applicable', products:[{name:'Jean recto',variant:'Azul · Talla M',price:890,image:'../../assets/catalog/blue-jeans.png'},{name:'Jean recto',variant:'Azul · Talla L',price:890,image:'../../assets/catalog/blue-jeans.png'}] },
  { id:'V-0126', time:'9:12 a. m.', date:todayLabel, dateISO:todayISO, type:'sale', typeLabel:'Venta', channel:'Instagram', comments:'Contactar antes de despachar.', client:{name:'Camila Ríos',phone:'+505 8632 9988',instagram:'@camila.rios',address:'Residencial Las Colinas, casa 42'}, total:1750, discount:0, payment:'paid', paid:1750, shippingPaid:150, delivery:'sent', paymentMovements:[{id:'P-0436',recordedAt:'Hoy · 10:05 a. m.',method:'Efectivo',currency:'NIO',productAmount:1750,shippingAmount:150,amountReceivedNio:1900}], deliveryHistory:{createdAt:'Hoy · 8:52 a. m.',sentAt:'Hoy · 11:15 a. m.'}, deliveryDetails:{code:'DEL-0126',municipalityId:1,municipalityName:'Managua',deliveryAgencyId:1,agencyName:'MANDA',shippingChargedToClient:150,deliveryAddress:'Las Colinas, del portón principal 2 cuadras al sur, casa 42.',comments:'Llamar antes de llegar.',agencyCollects:false}, products:[{name:'Vestido satinado',variant:'Coral · Talla M',price:950,image:'../../assets/catalog/coral-satin-dress.png',purpose:'direct'},{name:'Blusa seda',variant:'Champán · Talla M',price:800,image:'../../assets/catalog/blouse-champagne.png',purpose:'selection',selectionStatus:'kept'},{name:'Falda plisada',variant:'Negro · Talla S',price:740,image:'../../assets/catalog/black-skirt.png',purpose:'selection',selectionStatus:'rejected',returnedAt:null,includedInTotal:false},{name:'Jean recto',variant:'Azul · Talla M',price:890,image:'../../assets/catalog/blue-jeans.png',purpose:'selection',selectionStatus:'pending',includedInTotal:false}] },
  { id:'V-0125', time:'4:38 p. m.', date:'19 jul 2026', dateISO:'2026-07-19', type:'reservation', typeLabel:'Reserva', channel:'WhatsApp', comments:'', client:{name:'Sofía Gómez',phone:'+505 8547 1122'}, total:1500, discount:80, payment:'partial', paid:750, delivery:'none', products:[{name:'Falda plisada',variant:'Negro · Talla S',price:740,image:'../../assets/catalog/black-skirt.png'},{name:'Blusa seda',variant:'Marfil · Talla S',price:760,image:'../../assets/catalog/blouse-champagne.png'}] },
  { id:'V-0124', time:'2:15 p. m.', date:'18 jul 2026', dateISO:'2026-07-18', type:'sale', typeLabel:'Venta', channel:'Facebook', comments:'', client:{name:'Paola Ruiz',phone:'+505 8881 6677',messenger:'paola.ruiz'}, total:2340, discount:0, payment:'paid', paid:2340, delivery:'completed', products:[{name:'Vestido satinado',variant:'Coral · Talla L',price:1250,image:'../../assets/catalog/coral-satin-dress.png'},{name:'Jean recto',variant:'Azul · Talla S',price:1090,image:'../../assets/catalog/blue-jeans.png'}] },
  { id:'V-0123', time:'11:30 a. m.', date:'17 jul 2026', dateISO:'2026-07-17', type:'sale', typeLabel:'Venta', channel:'WhatsApp', comments:'', client:null, total:1240, discount:0, payment:'paid', paid:1240, delivery:'none', products:[{name:'Falda plisada',variant:'Negro · Talla M',price:590,image:'../../assets/catalog/black-skirt.png'},{name:'Blusa seda',variant:'Champán · Talla SM',price:650,image:'../../assets/catalog/blouse-champagne.png'}] },
  { id:'V-0122', time:'9:05 a. m.', date:'16 jul 2026', dateISO:'2026-07-16', type:'sale', typeLabel:'Venta', channel:'Instagram', comments:'Cancelada por solicitud de la clienta.', client:{name:'Laura Silva',phone:'+505 8722 1450'}, total:980, discount:0, payment:'cancelled', paid:0, delivery:'cancelled', saleStatus:'cancelled', cancellationReason:'La clienta desistió antes de preparar el pedido.', products:[{name:'Vestido satinado',variant:'Coral · Talla S',price:980,image:'../../assets/catalog/coral-satin-dress.png'}] }
];

try {
  const createdSale = JSON.parse(localStorage.getItem('pw-created-sale') || 'null');
  if (createdSale?.id && !sales.some(sale => sale.id === createdSale.id)) {
    if (['local','tienda física'].includes(String(createdSale.channel??createdSale.client?.channel??'').toLowerCase())) createdSale.delivery='not-applicable';
    sales.unshift(createdSale);
  }
} catch (error) {
  console.warn('No se pudo recuperar la venta creada en el prototipo.', error);
}

try {
  const updatedSale = JSON.parse(sessionStorage.getItem('pw-sale-detail') || 'null');
  const updatedIndex = sales.findIndex(sale => sale.id === updatedSale?.id);
  if (updatedIndex >= 0) sales[updatedIndex] = updatedSale;
} catch (error) {
  console.warn('No se pudieron recuperar los cambios del detalle de venta.', error);
}

const rows=document.querySelector('#salesRows');
const detail=document.querySelector('#saleDetail');
const tableRegion=document.querySelector('#salesTableRegion');
const loading=document.querySelector('#salesLoading');
const errorState=document.querySelector('#salesError');
const empty=document.querySelector('#salesEmpty');
const search=document.querySelector('#saleSearch');
const dateFrom=document.querySelector('#saleDateFrom');
const dateTo=document.querySelector('#saleDateTo');
const channel=document.querySelector('#saleChannel');
const operational=document.querySelector('#operationalStatus');
const payment=document.querySelector('#paymentStatus');
const delivery=document.querySelector('#deliveryStatus');
const resultCount=document.querySelector('#resultCount');
const paginationText=document.querySelector('#paginationText');
const previousPage=document.querySelector('#previousSalesPage');
const nextPage=document.querySelector('#nextSalesPage');
const pageButtons=document.querySelector('#salesPageButtons');
const paymentDialog=document.querySelector('#paymentDialog');
const paymentForm=document.querySelector('#paymentForm');
const existingPaymentMethod=document.querySelector('#existingPaymentMethod');
const existingPaymentAllocation=document.querySelector('#existingPaymentAllocation');
const existingPaymentCurrency=document.querySelector('#existingPaymentCurrency');
const existingPaymentReceived=document.querySelector('#existingPaymentReceived');
const existingExchangeRate=document.querySelector('#existingExchangeRate');
const existingExchangeRateField=document.querySelector('#existingExchangeRateField');
const existingPaymentCalculation=document.querySelector('#existingPaymentCalculation');
const existingCalculationNote=document.querySelector('#existingCalculationNote');
const existingTerminalField=document.querySelector('#existingTerminalField');
const existingPaymentTerminal=document.querySelector('#existingPaymentTerminal');
const deliveryDialog=document.querySelector('#deliveryDialog');
const saleEditDialog=document.querySelector('#saleEditDialog');
const saleEditForm=document.querySelector('#saleEditForm');
const toast=document.querySelector('#saleToast');
let selected=sales[0];
let toastTimer;
let currentPage=1;
const pageSize=4;

const money=value=>`C$ ${value.toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const roundMoney=value=>Math.round((value+Number.EPSILON)*100)/100;
const initials=name=>name.split(' ').slice(0,2).map(part=>part[0]).join('');
const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const saleChannel=sale=>sale.channel??sale.client?.channel??'Sin canal';
const clientName=sale=>sale.client?.name??'Sin cliente';
const clientPhone=sale=>sale.client?.phone??'';
const isLocalSale=sale=>['local','tienda física'].includes(String(saleChannel(sale)).toLowerCase());
const deliveryState=sale=>isLocalSale(sale)?'not-applicable':sale.delivery;
const shippingTotal=sale=>roundMoney(Number(sale.deliveryDetails?.shippingChargedToClient)||0);
const productPaid=sale=>roundMoney(Number(sale.productPaid??sale.paid)||0);
const shippingPaid=sale=>roundMoney(Number(sale.shippingPaid)||0);
const paymentBalances=sale=>{const products=Math.max(0,roundMoney(sale.total-productPaid(sale)));const shipping=Math.max(0,roundMoney(shippingTotal(sale)-shippingPaid(sale)));return{products,shipping,total:roundMoney(products+shipping)};};
const paymentMovementsFor=sale=>sale.paymentMovements?.length?sale.paymentMovements:(productPaid(sale)>0?[{id:`P-${sale.id}`,recordedAt:sale.date,method:'Efectivo',currency:'NIO',productAmount:productPaid(sale),shippingAmount:shippingPaid(sale)}]:[]);
const selectionItems=sale=>sale.products.filter(product=>product.purpose==='selection');
const selectionPending=sale=>selectionItems(sale).filter(product=>product.selectionStatus==='pending'||(product.selectionStatus==='rejected'&&!product.returnedAt));
const paymentMethodLabel=movement=>movement.method==='card'?`Tarjeta · ${String(movement.terminal||'Terminal').toUpperCase()}`:movement.method||'Pago';
const paymentBadge=sale=>{if(sale.saleStatus==='cancelled')return '<span class="status-badge sale-status-cancelled"><span class="status-icon" aria-hidden="true">×</span>Cancelada</span>';const balances=paymentBalances(sale);if(balances.products>0)return `<span class="status-badge payment-partial"><span class="status-icon" aria-hidden="true">◷</span>${money(balances.products)} pendiente</span>`;if(balances.shipping>0)return `<span class="status-badge payment-partial"><span class="status-icon" aria-hidden="true">◷</span>Envío ${money(balances.shipping)}</span>`;return '<span class="status-badge payment-paid"><span class="status-icon" aria-hidden="true">✓</span>Pagada</span>';};
const deliveryLabels={'not-applicable':['delivery-not-applicable','—','No aplica'],none:['delivery-none','○','Sin crear'],ready:['delivery-ready','▣','Pendiente'],sent:['delivery-sent','↗','Despachada'],'delivered-selection':['delivery-selection-pending','!','Entregada · selección'],completed:['delivery-completed','✓','Entregada'],failed:['delivery-failed','!','Entrega fallida'],cancelled:['delivery-cancelled','×','Cancelada']};
const deliveryBadge=sale=>{const [className,icon,label]=deliveryLabels[deliveryState(sale)]??deliveryLabels.none;const pending=selectionPending(sale).length;return `<span class="status-badge ${pending?'delivery-selection-pending':className}"><span class="status-icon" aria-hidden="true">${pending?'!':icon}</span>${pending?`${pending} por resolver`:label}</span>`};
const compactDeliveryBadge=sale=>{const [className,,label]=deliveryLabels[deliveryState(sale)]??deliveryLabels.none;return `<span class="status-badge ${className}">${label}</span>`;};
const operationalState=sale=>{if(sale.saleStatus==='cancelled')return'cancelled';if(sale.type==='reservation'&&deliveryState(sale)==='none')return'reserved';const state=deliveryState(sale);if(state==='ready')return'ready';if(state==='sent')return'sent';if(state==='completed'||(state==='not-applicable'&&paymentBalances(sale).total===0))return'completed';return'pending';};
const compactSaleDate=sale=>{const [,month,day]=String(sale.dateISO).split('-');const monthNames=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return `${Number(day)} ${monthNames[Number(month)-1]}`;};
const compactSaleTime=sale=>{if(sale.createdAtISO){const createdAt=new Date(sale.createdAtISO);if(!Number.isNaN(createdAt.getTime()))return createdAt.toLocaleTimeString("es-NI",{hour:"numeric",minute:"2-digit"});}return sale.time||"Sin hora";};
const compactPaymentBadge=sale=>{if(sale.saleStatus==='cancelled')return'<span class="status-badge sale-status-cancelled">Cancelada</span>';return paymentBalances(sale).total>0?'<span class="status-badge payment-partial">Pendiente</span>':'<span class="status-badge payment-paid">Pagada</span>';};
const operationalBadge=sale=>{const state=selectionPending(sale).length?'selection-pending':operationalState(sale);const label={'selection-pending':'En selección',pending:'Pendiente',reserved:'Reservada',ready:'Lista',sent:'Enviada',completed:'Completada',cancelled:'Cancelada'}[state]??'Pendiente';return `<span class="operational-badge operational-${state}" title="${state==='selection-pending'?'Selección pendiente':label}">${label}</span>`;};
const isoDaysAgo=days=>{const value=new Date(now);value.setHours(0,0,0,0);value.setDate(value.getDate()-days);return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');};
function matchesDate(sale){
  return(!dateFrom.value||sale.dateISO>=dateFrom.value)&&(!dateTo.value||sale.dateISO<=dateTo.value);
}

function filteredSales(){const term=search.value.trim().replace(/^#/,'').toLowerCase();return sales.filter(sale=>`${sale.id} ${clientName(sale)} ${clientPhone(sale)} ${sale.comments??''}`.toLowerCase().includes(term)&&matchesDate(sale)&&(!channel.value||saleChannel(sale)===channel.value)&&(!operational.value||operationalState(sale)===operational.value)&&(!payment.value||sale.payment===payment.value)&&(!delivery.value||deliveryState(sale)===delivery.value));}

function renderPagination(total){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  currentPage=Math.min(currentPage,pages);
  previousPage.disabled=currentPage===1||total===0;
  nextPage.disabled=currentPage===pages||total===0;
  pageButtons.innerHTML=Array.from({length:pages},(_,index)=>{const page=index+1;return `<button class="${page===currentPage?'is-page':''}" type="button" data-page="${page}" ${page===currentPage?'aria-current="page"':''}>${page}</button>`;}).join('');
  const start=total?(currentPage-1)*pageSize+1:0;const end=Math.min(currentPage*pageSize,total);
  paginationText.textContent=total?`Mostrando ${start}-${end} de ${total} ventas`:'Mostrando 0 ventas';
}

function render(){
  const filtered=filteredSales();
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));currentPage=Math.min(currentPage,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  if(!visible.includes(selected)&&visible.length) selected=visible[0];
  rows.innerHTML=visible.map(sale=>{const pendingSelection=selectionPending(sale).length>0;const rowClasses=[sale.saleStatus==='cancelled'?'is-cancelled':'',pendingSelection?'has-selection-pending':''].filter(Boolean).join(' ');const phone=clientPhone(sale);return `<tr class="${rowClasses}" data-id="${sale.id}"><td><span class="sale-cell"><span class="sale-id-line"><a class="sale-table-id" href="sale-detail.html" data-sale-detail="${sale.id}">${sale.id}</a><button class="copy-sale-id" type="button" data-copy-sale="${sale.id}" aria-label="Copiar número de venta ${sale.id}" title="Copiar número"></button></span></span></td><td><span class="client-cell" title="${escapeHTML(clientName(sale))}"><strong>${escapeHTML(clientName(sale))}</strong>${phone?`<small>${escapeHTML(phone)}</small>`:''}</span></td><td><time class="sales-date-cell" datetime="${sale.createdAtISO||sale.dateISO}" title="${sale.date} · ${compactSaleTime(sale)}"><strong>${compactSaleDate(sale)}</strong><small>${compactSaleTime(sale)}</small></time></td><td><span class="sales-channel-cell" title="${escapeHTML(saleChannel(sale))}">${escapeHTML(saleChannel(sale))}</span></td><td>${operationalBadge(sale)}</td><td>${compactPaymentBadge(sale)}</td><td>${compactDeliveryBadge(sale)}</td><td><span class="total-cell"><strong>${money(sale.total)}</strong></span></td><td><a class="sale-table-action" href="sale-detail.html" data-sale-detail="${sale.id}">Ver detalle</a></td></tr>`;}).join('');
  resultCount.textContent=`${filtered.length} ${filtered.length===1?'venta':'ventas'}`;
  renderPagination(filtered.length);
  empty.hidden=filtered.length>0;
  rows.closest('table').hidden=!filtered.length;
  detail.hidden=!filtered.length;
  if(filtered.length) renderDetail();
}

function renderDetail(){
  const sale=selected;
  const balances=paymentBalances(sale);
  const products=sale.products.map(product=>`<article class="detail-product"><img src="${product.image}" alt=""><div><strong>${product.name}</strong><small>${product.variant} · 1 unidad</small></div><strong>${money(product.price)}</strong></article>`).join('');
  const localSale=isLocalSale(sale);const hasClient=Boolean(sale.client?.name);const deliveryStatus=localSale?'not-applicable':sale.delivery;
  const deliveryText={'not-applicable':'Retiro realizado en tienda.',none:'Aún no hay entrega asignada.',ready:'La entrega está pendiente de despacho.',sent:'La venta ya fue despachada.','delivered-selection':'La clienta recibió la entrega; falta resolver la selección.',completed:'La entrega fue completada.',failed:'La agencia no pudo completar la entrega.',cancelled:'La entrega fue cancelada antes del despacho.'}[deliveryStatus];
  const canCreateDelivery=!localSale&&hasClient&&sale.delivery==='none'&&sale.saleStatus!=='cancelled';
  const canSendDelivery=!localSale&&sale.delivery==='ready'&&(balances.total===0||sale.deliveryDetails?.agencyCollects);
  const deliveryInfo=sale.deliveryDetails;const assignedDeliverySummary=deliveryInfo?`${deliveryInfo.agencyName} · ${deliveryInfo.municipalityName} · Envío ${money(deliveryInfo.shippingChargedToClient)}`:'';
  const pendingSelections=selectionPending(sale).length;
  const deliveryHelp=localSale?'Esta operación no genera envío ni cargos asociados.':!hasClient?'Agrega un cliente a la venta antes de crear la entrega.':pendingSelections?`${pendingSelections} ${pendingSelections===1?'prenda requiere':'prendas requieren'} una decisión o confirmar su devolución.`:sale.delivery==='none'?(balances.products>0?'Puedes asignar la entrega ahora; el pago se validará al despacharla.':'Asigna la agencia y los datos de entrega para continuar.'):sale.delivery==='ready'?(assignedDeliverySummary|| (balances.total>0&&!sale.deliveryDetails?.agencyCollects?'Completa los saldos o asigna el cobro a la agencia para despachar.':'La entrega puede despacharse.')):'Consulta el ciclo completo en el detalle.';
  const sendAction=!localSale&&sale.delivery==='ready'?`<div class="detail-actions"><button class="detail-primary" type="button" id="sendDelivery" ${canSendDelivery?'':'disabled aria-describedby="deliveryBlockedReason"'}>Marcar como enviada</button></div>`:'';
  const compactProducts=sale.products.slice(0,2).map(product=>`<span class="compact-product"><img src="${product.image}" alt=""><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.variant)}</small></span></span>`).join('');
  const moreProducts=sale.products.length>2?`<span class="compact-product-more">+${sale.products.length-2}</span>`:'';
  const socialChannel=String(saleChannel(sale)).toLowerCase();
  const socialContact=socialChannel==='instagram'&&sale.client?.instagram?{label:'Instagram',value:sale.client.instagram}:['messenger','facebook'].includes(socialChannel)&&sale.client?.messenger?{label:'Messenger',value:sale.client.messenger}:null;
  const socialContactMarkup=socialContact?`<span class="customer-social"><b>${socialContact.label}</b>${escapeHTML(socialContact.value)}</span>`:'';
  const paymentAction=sale.saleStatus==='cancelled'?'<span class="status-badge sale-status-cancelled"><span class="status-icon" aria-hidden="true">×</span>Venta cancelada</span>':balances.total>0?'<button class="detail-primary compact-payment-button compact-panel-action" type="button" id="registerPayment">Registrar pago</button>':'<span class="status-badge payment-paid"><span class="status-icon" aria-hidden="true">✓</span>Sin saldo</span>';
  detail.innerHTML=`
    <header>
      <div class="detail-title-block"><p class="detail-kicker">Resumen de venta</p><h2>Venta #${sale.id}</h2><span class="detail-meta">${sale.date} · ${sale.typeLabel}</span><div class="detail-title-actions"><button class="section-edit-button" type="button" data-edit-sale><span aria-hidden="true">✎</span> Editar venta</button><a class="detail-full-link" href="sale-detail.html?id=${encodeURIComponent(sale.id)}" data-full-detail>Ver más <span aria-hidden="true">→</span></a></div></div>
      <div class="detail-header-actions">
        <div class="detail-header-status"><span class="sale-kind">${saleChannel(sale)}</span>${paymentBadge(sale)}</div>
      </div>
    </header>
    <section class="detail-section compact-section customer-section">
      <div class="detail-section-heading"><div><h3>Cliente</h3></div></div>
      ${hasClient?`<div class="customer-summary"><div><strong>${escapeHTML(clientName(sale))}</strong><span>${escapeHTML(clientPhone(sale))}</span>${socialContactMarkup}</div></div>`:`<div class="customer-summary customer-empty"><div><strong>Sin cliente asociado</strong><span>El cliente es opcional hasta crear una entrega.</span></div></div>`}
    </section>
    <section class="detail-section compact-section"><div class="compact-summary-heading"><div><h3>Prendas</h3><p>${sale.products.length} ${sale.products.length===1?'prenda':'prendas'}</p></div><strong>${money(sale.total)}</strong></div><div class="compact-product-list">${compactProducts}${moreProducts}</div></section>
    <section class="detail-section compact-section compact-payment-section"><div class="compact-balance"><span>Total pendiente</span><strong class="${balances.total?'has-balance':''}">${money(balances.total)}</strong><small>Productos ${money(balances.products)} · Envío ${money(balances.shipping)}</small></div>${paymentAction}</section>
    <section class="detail-section compact-section"><div class="detail-section-heading"><div><h3>${localSale?'Retiro':'Entrega'}</h3><p>${deliveryText}</p></div>${canCreateDelivery?'<button class="detail-primary compact-panel-action" type="button" id="createDelivery">Crear entrega</button>':deliveryStatus==='none'?'':deliveryBadge(sale)}</div>${!localSale&&sale.delivery==='ready'&&balances.total>0&&!sale.deliveryDetails?.agencyCollects?`<p class="blocked-note" id="deliveryBlockedReason">Falta recibir ${money(balances.total)} o asignar el cobro a la agencia.</p>`:''}${!localSale&&!hasClient&&sale.delivery==='none'?'<div class="detail-actions delivery-actions"><button class="detail-secondary" type="button" data-edit-sale>Agregar cliente</button></div>':''}${sendAction}</section>`;
}

function selectRow(target){const row=target.closest('tr');if(!row)return;selected=sales.find(sale=>sale.id===row.dataset.id);render();if(matchMedia('(max-width: 1220px)').matches)detail.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
function copySaleNumber(id){
  const fallback=()=>{const helper=document.createElement('textarea');helper.value=id;helper.setAttribute('readonly','');helper.style.position='fixed';helper.style.opacity='0';document.body.append(helper);helper.select();document.execCommand('copy');helper.remove();};
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(id).catch(fallback);else fallback();
  showToast(`Número ${id} copiado.`);
}
rows.addEventListener('click',event=>{const copyButton=event.target.closest('[data-copy-sale]');if(copyButton){event.stopPropagation();copySaleNumber(copyButton.dataset.copySale);return;}const detailLink=event.target.closest('[data-sale-detail]');if(detailLink){selected=sales.find(sale=>sale.id===detailLink.dataset.saleDetail);sessionStorage.setItem('pw-sale-detail',JSON.stringify(selected));}});
[search,dateFrom,dateTo,channel,operational,payment,delivery].forEach(control=>control.addEventListener('input',()=>{currentPage=1;dateFrom.max=dateTo.value||'';dateTo.min=dateFrom.value||'';render();}));
pageButtons.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(!button)return;currentPage=Number(button.dataset.page);render();tableRegion.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
previousPage.addEventListener('click',()=>{if(currentPage>1){currentPage-=1;render();tableRegion.scrollTo({top:0,behavior:'smooth'});}});
nextPage.addEventListener('click',()=>{const pages=Math.ceil(filteredSales().length/pageSize);if(currentPage<pages){currentPage+=1;render();tableRegion.scrollTo({top:0,behavior:'smooth'});}});
function setDefaultDate(){dateFrom.value=todayISO;dateTo.value=todayISO;dateFrom.max=todayISO;dateTo.min=todayISO;}
function clearFilters(){document.querySelector('#salesFilters').reset();currentPage=1;setDefaultDate();render();search.focus();}
document.querySelector('#clearSalesFilters').addEventListener('click',event=>{event.preventDefault();clearFilters();});
document.querySelector('#emptySalesClear').addEventListener('click',clearFilters);
document.querySelector('#retrySales').addEventListener('click',()=>showContent());

function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},3200);}
function openSaleEditDialog(){
  if(selected.saleStatus==='cancelled'){showToast('La venta está cancelada y no puede editarse.');return;}
  saleEditForm.reset();
  const clientSelect=saleEditForm.elements.client;
  const currentClient=selected.client;
  if(currentClient&&!Array.from(clientSelect.options).some(option=>option.value===currentClient.name)){
    const option=new Option(`${currentClient.name} · ${currentClient.phone}`,currentClient.name);
    option.dataset.phone=currentClient.phone;clientSelect.append(option);
  }
  const deliveryAssigned=['ready','sent','delivered-selection','completed','failed'].includes(deliveryState(selected));
  clientSelect.options[0].disabled=deliveryAssigned;
  clientSelect.value=currentClient?.name??'';
  const channelSelect=saleEditForm.elements.channel;
  channelSelect.querySelector('option[value="Tienda física"]').disabled=deliveryAssigned;
  channelSelect.value=isLocalSale(selected)?'Tienda física':saleChannel(selected);
  saleEditForm.elements.comments.value=selected.comments??'';
  document.querySelector('#saleEditDialogTitle').textContent=currentClient?'Editar información':'Agregar cliente e información';
  document.querySelector('#saleEditHelp').textContent=deliveryAssigned?'Puedes cambiar el cliente y los comentarios. Como la entrega ya fue creada, la venta debe conservar un cliente y un canal remoto.':'El cliente sigue siendo opcional, pero será necesario antes de crear una entrega.';
  saleEditDialog.showModal();clientSelect.focus();
}
detail.addEventListener('click',event=>{
  if(event.target.closest('[data-full-detail]'))sessionStorage.setItem('pw-sale-detail',JSON.stringify(selected));
  if(event.target.closest('#registerPayment')){if(selected.saleStatus==='cancelled'){showToast('No se pueden registrar pagos en una venta cancelada.');return;}paymentForm.reset();const balances=paymentBalances(selected);document.querySelector('#paymentHelp').innerHTML=`<span><small>Productos</small><strong>${money(balances.products)}</strong></span><span><small>Envío</small><strong>${money(balances.shipping)}</strong></span><span><small>Total pendiente</small><strong>${money(balances.total)}</strong></span>`;existingPaymentAllocation.querySelector('option[value="shipping"]').disabled=balances.shipping===0;existingPaymentAllocation.value='automatic';document.querySelector('#existingPaymentError').textContent='';updateExistingPaymentCurrency();paymentDialog.showModal();paymentForm.elements.allocation.focus();}
  if(event.target.closest('[data-edit-sale]')){openSaleEditDialog();}
  if(event.target.closest('#createDelivery')){if(selected.saleStatus==='cancelled'){showToast('No se puede crear una entrega para una venta cancelada.');return;}if(isLocalSale(selected)){showToast('Las ventas locales no pueden tener envíos.');return;}if(!selected.client){showToast('Agrega un cliente antes de crear la entrega.');return;}const form=document.querySelector('#deliveryForm');form.reset();form.elements.contactPhone.value=selected.client.phone;form.elements.code.value=`DEL-${selected.id.replace(/\D/g,'')}`;deliveryDialog.showModal();form.elements.deliveryAgencyId.focus();}
  if(event.target.closest('#sendDelivery')){const balance=paymentBalances(selected).total;if(isLocalSale(selected)){showToast('Las ventas locales no pueden tener envíos.');return;}if(balance>0&&!selected.deliveryDetails?.agencyCollects){showToast(`Falta recibir ${money(balance)} o asignar el cobro a la agencia antes de despachar.`);return;}selected.delivery='sent';selected.deliveryHistory={...selected.deliveryHistory,sentAt:'Hoy · ahora'};render();showToast(balance?`Despachada. La agencia debe cobrar ${money(balance)}.`:`La venta #${selected.id} fue marcada como despachada.`);}
});
function calculateExistingPayment(){
  const received=Number(existingPaymentReceived.value);const rate=Number(existingExchangeRate.value);const balances=paymentBalances(selected);const allocation=existingPaymentAllocation.value;const balance=allocation==='products'?balances.products:allocation==='shipping'?balances.shipping:balances.total;
  if(!received||received<=0||(existingPaymentCurrency.value==='USD'&&(!rate||rate<=0)))return null;
  const converted=existingPaymentCurrency.value==='USD'?received*rate:received;const amount=roundMoney(Math.min(converted,balance));
  let change=roundMoney(Math.max(0,converted-amount));
  if(existingPaymentCurrency.value==='USD'&&converted>=balance&&change<=.5)change=0;
  const productAmount=allocation==='shipping'?0:roundMoney(Math.min(amount,balances.products));const shippingAmount=allocation==='products'?0:roundMoney(Math.min(amount-productAmount,balances.shipping));
  return {received,rate,converted,balance,amount,productAmount,shippingAmount,change,exchangeDifferenceNio:existingPaymentCurrency.value==='USD'?roundMoney(converted-change-amount):0};
}
function renderExistingPaymentCalculation(){
  const calculation=calculateExistingPayment();existingPaymentCalculation.hidden=!calculation;
  if(!calculation){
    const rate=Number(existingExchangeRate.value);const balances=paymentBalances(selected);const balance=existingPaymentAllocation.value==='products'?balances.products:existingPaymentAllocation.value==='shipping'?balances.shipping:balances.total;const canSuggest=existingPaymentCurrency.value==='USD'&&rate>0&&balance>0;
    existingCalculationNote.hidden=!canSuggest;
    if(canSuggest)existingCalculationNote.textContent=`Monto sugerido para cubrir ${money(balance)}: $ ${(Math.ceil(balance/rate*100)/100).toFixed(2)}.`;
    return;
  }
  existingCalculationNote.hidden=false;document.querySelector('#existingReceivedValueNio').textContent=money(roundMoney(calculation.converted));document.querySelector('#existingProductAppliedPreview').textContent=money(calculation.productAmount);document.querySelector('#existingShippingAppliedPreview').textContent=money(calculation.shippingAmount);document.querySelector('#existingAppliedPreview').textContent=money(calculation.amount);document.querySelector('#existingChangePreview').textContent=money(calculation.change);
  const hasExchangeDifference=existingPaymentCurrency.value==='USD'&&calculation.change===0&&Math.abs(calculation.exchangeDifferenceNio)>=.01;
  existingCalculationNote.textContent=calculation.change>0?'El cambio se entrega en córdobas; solo el saldo necesario se aplica a la venta.':hasExchangeDifference?`La diferencia de conversión de ${money(Math.abs(calculation.exchangeDifferenceNio))} se registra sin entregar cambio.`:'Para combinar monedas, registra este movimiento y luego agrega el siguiente sobre el saldo actualizado.';
}
function updateExistingPaymentCurrency(){
  const isCard=existingPaymentMethod.value==='card';const acceptsUsd=!isCard;if(!acceptsUsd)existingPaymentCurrency.value='NIO';existingPaymentCurrency.disabled=!acceptsUsd;existingTerminalField.hidden=!isCard;existingPaymentTerminal.required=isCard;
  const isUsd=existingPaymentCurrency.value==='USD';const isTransfer=existingPaymentMethod.value==='transfer';existingExchangeRateField.hidden=!isUsd;document.querySelector('#existingReceivedLabel').textContent=isTransfer?'Monto transferido':'Monto recibido';document.querySelector('#existingReceivedUnit').textContent=isUsd?'$':'C$';document.querySelector('#existingCurrencyHelp').textContent=acceptsUsd?'Efectivo y transferencia admiten córdobas o dólares. Cada moneda se registra por separado.':'Los pagos con tarjeta se procesan en córdobas y requieren seleccionar la terminal.';existingPaymentReceived.value='';document.querySelector('#existingPaymentError').textContent='';renderExistingPaymentCalculation();
}
existingPaymentAllocation.addEventListener('change',renderExistingPaymentCalculation);existingPaymentMethod.addEventListener('change',updateExistingPaymentCurrency);existingPaymentCurrency.addEventListener('change',updateExistingPaymentCurrency);existingPaymentReceived.addEventListener('input',renderExistingPaymentCalculation);existingExchangeRate.addEventListener('input',renderExistingPaymentCalculation);
paymentForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;event.preventDefault();const calculation=calculateExistingPayment();const error=document.querySelector('#existingPaymentError');
  if(!calculation){error.textContent=existingPaymentCurrency.value==='USD'?'Ingresa un monto recibido y una tasa de cambio válidos.':'Ingresa el monto que entregó la clienta.';existingPaymentReceived.focus();return;}if(existingPaymentMethod.value==='card'&&!existingPaymentTerminal.value){error.textContent='Selecciona la terminal que procesó el pago.';existingPaymentTerminal.focus();return;}
  selected.paymentMovements??=[];selected.paymentMovements.push({id:`P-${String(Date.now()).slice(-4)}`,recordedAt:'Ahora',method:existingPaymentMethod.value==='card'?'card':existingPaymentMethod.selectedOptions[0].textContent,terminal:existingPaymentMethod.value==='card'?existingPaymentTerminal.value:undefined,currency:existingPaymentCurrency.value,productAmount:calculation.productAmount,shippingAmount:calculation.shippingAmount,amountReceivedNio:existingPaymentCurrency.value==='NIO'?calculation.received:undefined,amountReceivedUsd:existingPaymentCurrency.value==='USD'?calculation.received:undefined,exchangeRate:existingPaymentCurrency.value==='USD'?calculation.rate:undefined,changeGivenNio:calculation.change});selected.productPaid=roundMoney(productPaid(selected)+calculation.productAmount);selected.paid=selected.productPaid;selected.shippingPaid=roundMoney(shippingPaid(selected)+calculation.shippingAmount);selected.payment=selected.productPaid>=selected.total?'paid':'partial';paymentDialog.close('saved');render();showToast(calculation.change>0?`Pago registrado. Entrega ${money(calculation.change)} de cambio.`:`Pago de ${money(calculation.amount)} registrado en la venta #${selected.id}.`);
});
saleEditForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;
  event.preventDefault();
  const clientOption=saleEditForm.elements.client.selectedOptions[0];
  const previousClient=selected.client?.name??'';
  const previousChannel=saleChannel(selected);
  selected.client=clientOption.value?{name:clientOption.value,phone:clientOption.dataset.phone}:null;
  selected.channel=saleEditForm.elements.channel.value;
  selected.comments=saleEditForm.elements.comments.value.trim();
  if(isLocalSale(selected))selected.delivery='not-applicable';
  else if(selected.delivery==='not-applicable')selected.delivery='none';
  const storedSale=JSON.parse(localStorage.getItem('pw-created-sale')||'null');
  if(storedSale?.id===selected.id)localStorage.setItem('pw-created-sale',JSON.stringify(selected));
  saleEditDialog.close('saved');render();
  const changedClient=previousClient!==(selected.client?.name??'');const changedChannel=previousChannel!==selected.channel;
  showToast(changedClient||changedChannel?`Información de la venta #${selected.id} actualizada.`:'Comentarios actualizados.');
});
deliveryDialog.addEventListener('close',()=>{if(deliveryDialog.returnValue!=='save')return;if(isLocalSale(selected)){showToast('Las ventas locales no pueden tener envíos.');render();return;}if(!selected.client){showToast('Agrega un cliente antes de crear la entrega.');render();return;}const form=document.querySelector('#deliveryForm');const agency=form.elements.deliveryAgencyId.selectedOptions[0];const municipality=form.elements.municipalityId.selectedOptions[0];selected.deliveryDetails={code:form.elements.code.value.trim(),municipalityId:Number(form.elements.municipalityId.value),municipalityName:municipality.textContent,deliveryAgencyId:Number(form.elements.deliveryAgencyId.value),agencyName:agency.textContent,shippingChargedToClient:Number(form.elements.shippingChargedToClient.value),deliveryAddress:form.elements.deliveryAddress.value.trim()||undefined,comments:form.elements.comments.value.trim()||undefined,agencyCollects:form.elements.agencyCollects.checked};selected.deliveryHistory={createdAt:'Hoy · ahora'};selected.delivery='ready';render();showToast(`Entrega creada para la venta #${selected.id}.`);});

const root=document.documentElement;
const themeButton=document.querySelector('.theme-button');
function setTheme(theme){root.dataset.theme=theme;const dark=theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Activar modo claro':'Activar modo oscuro');themeButton.querySelector('.theme-label').textContent=dark?'Modo claro':'Modo oscuro';localStorage.setItem('pw-theme',theme);}
setTheme(localStorage.getItem('pw-theme')||'light');
themeButton.addEventListener('click',()=>setTheme(root.dataset.theme==='dark'?'light':'dark'));

const menuButton=document.querySelector('.menu-button');
const sidebar=document.querySelector('.sidebar');
const navBackdrop=document.querySelector('.nav-backdrop');
function closeMenu(){sidebar.classList.remove('is-open');navBackdrop.hidden=true;menuButton.setAttribute('aria-expanded','false');}
menuButton.setAttribute('aria-expanded','false');
menuButton.addEventListener('click',()=>{const opening=!sidebar.classList.contains('is-open');sidebar.classList.toggle('is-open',opening);navBackdrop.hidden=!opening;menuButton.setAttribute('aria-expanded',String(opening));if(opening)sidebar.querySelector('a').focus();});
navBackdrop.addEventListener('click',closeMenu);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('is-open')){closeMenu();menuButton.focus();}});

function showContent(){loading.hidden=true;errorState.hidden=true;tableRegion.hidden=false;render();}
const requestedState=new URLSearchParams(location.search).get('state');
setDefaultDate();
setTimeout(()=>{if(requestedState==='error'){loading.hidden=true;errorState.hidden=false;tableRegion.hidden=true;detail.hidden=true;}else{showContent();if(requestedState==='empty'){search.value='venta inexistente';render();}if(new URLSearchParams(location.search).get('created')==='1')showToast('Venta #V-0129 creada. Ya aparece en el listado.');}},240);
