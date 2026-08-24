const fallbackSale={id:'V-0128',date:'20 jul 2026',dateISO:'2026-07-20',type:'reservation',typeLabel:'Reserva',channel:'WhatsApp',comments:'Separar ambas prendas para retiro por la tarde.',client:{id:'C-101',name:'Ana Martínez',phone:'+505 8888 2200',instagram:'@ana.martinez',messenger:'Ana Martínez'},total:2050,discount:90,payment:'partial',paid:1000,shippingPaid:0,delivery:'none',paymentMovements:[{id:'P-0431',recordedAt:'Hoy · 10:24 a. m.',method:'Transferencia',currency:'USD',productAmount:1000,shippingAmount:0,amountReceivedUsd:27.31,exchangeRate:36.62,changeGivenNio:0}],products:[{name:'Vestido satinado',variant:'Coral · Talla S',price:1250,regularPrice:1340,manualDiscount:90,image:'../../assets/catalog/coral-satin-dress.png',purpose:'direct'},{name:'Blusa seda',variant:'Champán · Talla M',price:800,regularPrice:800,image:'../../assets/catalog/blouse-champagne.png',purpose:'direct'},{name:'Pantalón palazzo',variant:'Azul medio · Talla M',price:1190,regularPrice:1190,image:'../../assets/catalog/blue-jeans.png',purpose:'selection',selectionStatus:'pending',includedInTotal:false}]};
const requestedId=new URLSearchParams(location.search).get('id');
let storedSale=null;
try{storedSale=JSON.parse(sessionStorage.getItem('pw-sale-detail')||'null');}catch(error){console.warn('No se pudo recuperar la venta seleccionada.',error);}
const sale=storedSale?.id===requestedId?storedSale:fallbackSale;
const root=document.documentElement;
const content=document.querySelector('#saleRecordContent');
const toast=document.querySelector('#recordToast');
const paymentDialog=document.querySelector('#paymentDialog');
const paymentForm=document.querySelector('#paymentForm');
const existingPaymentMethod=document.querySelector('#existingPaymentMethod');
const existingPaymentCurrency=document.querySelector('#existingPaymentCurrency');
const existingPaymentReceived=document.querySelector('#existingPaymentReceived');
const existingExchangeRate=document.querySelector('#existingExchangeRate');
const existingExchangeRateField=document.querySelector('#existingExchangeRateField');
const existingPaymentCalculation=document.querySelector('#existingPaymentCalculation');
const existingTerminalField=document.querySelector('#existingTerminalField');
const existingPaymentTerminal=document.querySelector('#existingPaymentTerminal');
const deliveryDialog=document.querySelector('#deliveryDialog');
const deliveryEditDialog=document.querySelector('#deliveryEditDialog');
const deliveryEditForm=document.querySelector('#deliveryEditForm');
const deliveryActionDialog=document.querySelector('#deliveryActionDialog');
const deliveryActionForm=document.querySelector('#deliveryActionForm');
const clientDialog=document.querySelector('#clientDialog');
const clientDialogForm=document.querySelector('#clientDialogForm');
const clientSearchInput=document.querySelector('#clientSearch');
const clientSearchResults=document.querySelector('#clientSearchResults');
const clientSearchEmpty=document.querySelector('#clientSearchEmpty');
const clientSaveButton=document.querySelector('#clientSaveButton');
const adminPaymentDialog=document.querySelector('#adminPaymentDialog');
const adminPaymentForm=document.querySelector('#adminPaymentForm');
const adminRefundDialog=document.querySelector('#adminRefundDialog');
const adminRefundForm=document.querySelector('#adminRefundForm');
const adminCancelDialog=document.querySelector('#adminCancelDialog');
const adminCancelForm=document.querySelector('#adminCancelForm');
const currentUser={name:'María Pérez',role:'Administradora',permissions:['deliveries.edit','deliveries.dispatch','deliveries.update-status','deliveries.cancel','deliveries.correct-status','sales.edit-items','payments.correct-nio','payments.refund','sales.cancel']};
let pendingDeliveryAction=null;
let refundTargetMovementId=null;
let toastTimer;

const money=value=>`C$ ${Number(value||0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const roundMoney=value=>Math.round((Number(value||0)+Number.EPSILON)*100)/100;
const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const initials=name=>String(name||'').split(' ').slice(0,2).map(part=>part[0]).join('');
const shippingTotal=()=>roundMoney(sale.deliveryDetails?.shippingChargedToClient||0);
const productPaid=()=>roundMoney(sale.productPaid??sale.paid);
const shippingPaid=()=>roundMoney(sale.shippingPaid||0);
const productBalance=()=>isSaleCancelled()?0:Math.max(0,roundMoney(sale.total-productPaid()));
const shippingBalance=()=>isSaleCancelled()?0:Math.max(0,roundMoney(shippingTotal()-shippingPaid()));
const totalBalance=()=>roundMoney(productBalance()+shippingBalance());
const paymentBalances=()=>({products:productBalance(),shipping:shippingBalance(),total:totalBalance()});
const productRefundDue=()=>Math.max(0,roundMoney(productPaid()-sale.total));
const shippingRefundDue=()=>Math.max(0,roundMoney(shippingPaid()-shippingTotal()));
const totalRefundDue=()=>roundMoney(productRefundDue()+shippingRefundDue());
const isLocalSale=()=>['local','tienda física'].includes(String(sale.channel).toLowerCase());
const deliveryStatus=()=>isLocalSale()?'not-applicable':sale.delivery;
const selectionProducts=()=>sale.products.filter(product=>product.purpose==='selection');
const directProducts=()=>sale.products.filter(product=>product.purpose!=='selection');
const pendingDecisions=()=>selectionProducts().filter(product=>(product.selectionStatus||'pending')==='pending');
const pendingReturns=()=>selectionProducts().filter(product=>product.selectionStatus==='rejected'&&!product.returnedAt);
const openSelectionTasks=()=>pendingDecisions().length+pendingReturns().length;
const isIncludedInTotal=product=>product.includedInTotal??product.selectionStatus==='kept';
const deliveryLabels={'not-applicable':'No aplica',none:'Sin crear',ready:'Pendiente',sent:'Despachada','delivered-selection':'Entregada · selección pendiente',completed:'Entregada',failed:'Entrega fallida',cancelled:'Cancelada'};
const deliveryBadgeClasses={'not-applicable':'delivery-none',none:'delivery-none',ready:'delivery-ready',sent:'delivery-sent','delivered-selection':'delivery-selection-pending',completed:'delivery-completed',failed:'delivery-failed',cancelled:'delivery-cancelled'};
const hasPermission=permission=>currentUser.permissions.includes(permission);
const deliveryDetails=()=>sale.deliveryDetails||{};
const isSaleCancelled=()=>sale.saleStatus==='cancelled';
const netPaid=()=>roundMoney(productPaid()+shippingPaid());
const editableItems=()=>!isSaleCancelled()&&['none','not-applicable','ready','cancelled'].includes(deliveryStatus());
const correctableMovements=()=>sale.paymentMovements?.filter(movement=>!movement.isRefund)??[];
const cancellationBlockers=()=>{
  const blockers=[];const status=deliveryStatus();
  if(isSaleCancelled())blockers.push('La venta ya está cancelada.');
  if(netPaid()>0)blockers.push(`Hay ${money(netPaid())} recibidos. Reembolsa el dinero antes de cancelar.`);
  if(status==='ready')blockers.push('Hay una entrega pendiente. Cancélala primero.');
  if(['sent','delivered-selection','completed'].includes(status))blockers.push('La entrega ya salió de la tienda; debe resolverse antes de cancelar la venta.');
  if(status==='failed')blockers.push('La entrega fallida todavía conserva una asignación. Reprográmala y cancélala primero.');
  return blockers;
};

function setProductIncluded(product,included){
  const wasIncluded=isIncludedInTotal(product);if(wasIncluded===included)return;
  sale.total=roundMoney(Math.max(0,sale.total+(included?Number(product.price||0):-Number(product.price||0))));
  product.includedInTotal=included;sale.payment=productPaid()>=sale.total?'paid':'partial';
}

function persistSale(){
  sessionStorage.setItem('pw-sale-detail',JSON.stringify(sale));
  try{const created=JSON.parse(localStorage.getItem('pw-created-sale')||'null');if(created?.id===sale.id)localStorage.setItem('pw-created-sale',JSON.stringify(sale));}catch(error){console.warn('No se pudo actualizar la venta guardada.',error);}
}

function showToast(message){
  clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;
  toastTimer=setTimeout(()=>{toast.hidden=true;},3200);
}

const saleChannelOptions=['Tienda física','WhatsApp','Instagram','Facebook'];
const saleClientOptions=[
  {id:'C-101',name:'Ana Martínez',phone:'+505 8888 2200',instagram:'@ana.martinez',messenger:'Ana Martínez',address:'Residencial Las Colinas, Managua'},
  {id:'C-102',name:'María López',phone:'+505 8756 4321',instagram:'@maria.lopez',messenger:'Maria Lopez',address:'Altamira, Managua'},
  {id:'C-103',name:'Sofía Gómez',phone:'+505 8547 1122',instagram:'@sofia.gomez',messenger:'Sofía Gómez',address:''}
];
let selectedClientId='';

const saleDateLabel=value=>new Date(`${value}T12:00:00`).toLocaleDateString('es-NI',{day:'numeric',month:'short',year:'numeric'}).replace(/\./g,'');
const saleClientId=()=>sale.client?.id||saleClientOptions.find(client=>client.name===sale.client?.name)?.id||'';

function saleMetaOption(value,label,current){
  return `<option value="${escapeHTML(value)}"${value===current?' selected':''}>${escapeHTML(label)}</option>`;
}

function saleMetaEditor(){
  const channelOptions=saleChannelOptions.map(channel=>saleMetaOption(channel,channel,sale.channel)).join('');
  return `<form class="record-overview-editor" id="saleMetaForm" aria-label="Editar información general de la venta">
    <label><span>Fecha de la venta</span><input name="saleDate" type="date" value="${escapeHTML(sale.dateISO||'')}" required /></label>
    <label><span>Canal de venta</span><select name="saleChannel">${channelOptions}</select></label>
    <label class="sale-overview-comment"><span>Comentario de la venta</span><textarea name="saleComments" rows="2" maxlength="500" placeholder="Agrega una indicación para esta venta…">${escapeHTML(sale.comments||'')}</textarea></label>
    <div class="sale-overview-actions"><button class="primary-action" type="submit">Guardar cambios</button></div>
  </form>`;
}

function saveSaleMeta(form){
  const values=new FormData(form);const nextDate=String(values.get('saleDate')||'');const nextChannel=values.get('saleChannel');const nextComments=String(values.get('saleComments')||'').trim();
  if(nextDate){sale.dateISO=nextDate;sale.date=saleDateLabel(nextDate);}
  if(nextChannel){sale.channel=String(nextChannel);}
  sale.comments=nextComments;
  persistSale();render();showToast('Cambios de la venta guardados.');
}

function clientMatches(client,query){
  const haystack=[client.name,client.phone,client.instagram,client.messenger].filter(Boolean).join(' ').toLocaleLowerCase('es');
  return haystack.includes(query.toLocaleLowerCase('es'));
}

function clientResult(client){
  const selected=client.id===selectedClientId;
  return `<button class="client-search-result${selected?' is-selected':''}" type="button" data-client-result="${escapeHTML(client.id)}" role="option" aria-selected="${selected}"><span class="customer-avatar">${initials(client.name)}</span><span class="client-result-main"><strong>${escapeHTML(client.name)}</strong><span>${escapeHTML(client.phone||'Sin teléfono')}</span><small>${client.instagram?`Instagram ${escapeHTML(client.instagram)}`:'Sin Instagram'} · ${client.messenger?`Messenger ${escapeHTML(client.messenger)}`:'Sin Messenger'}</small></span></button>`;
}

function renderClientSearch(){
  const query=clientSearchInput.value.trim();const matches=saleClientOptions.filter(client=>clientMatches(client,query));
  clientSearchResults.innerHTML=matches.map(clientResult).join('');clientSearchEmpty.hidden=matches.length>0;
  clientSaveButton.disabled=!selectedClientId;
}

function openClientDialog(){
  selectedClientId='';clientSearchInput.value='';renderClientSearch();clientDialog.showModal();clientSearchInput.focus();
}

function saveSelectedClient(){
  const selectedClient=saleClientOptions.find(client=>client.id===selectedClientId);if(!selectedClient)return;
  sale.client={...selectedClient};persistSale();clientDialog.close('saved');render();showToast(`Cliente cambiado a ${selectedClient.name}.`);
}

function productRow(product){
  const quantity=Number(product.quantity||1);
  const variant=String(product.variant||'').split(/\s*·\s*Talla\s*/i);
  const color=product.color||variant[0]||'Sin especificar';
  const size=product.size||variant[1]||'—';
  const isSelection=product.purpose==='selection';
  const hasRegularPrice=Number.isFinite(Number(product.regularPrice));
  const lineSubtotal=roundMoney(hasRegularPrice?Number(product.regularPrice):Number(product.price||0)*quantity);
  const lineTotal=roundMoney(hasRegularPrice?Number(product.price||0):lineSubtotal);
  const lineDiscount=roundMoney(Math.max(0,lineSubtotal-lineTotal));
  const unitPrice=roundMoney(quantity?lineSubtotal/quantity:0);
  const selectionState=isSelection?selectionStatus(product):null;
  const purpose=isSelection?`En selección · ${selectionState.label}`:'Venta directa';
  const totalLabel=isSelection&&!isIncludedInTotal(product)?(product.selectionStatus==='rejected'?'C$ 0.00':'Pendiente'):money(lineTotal);
  const selectionControls=isSelection?`<div class="selection-inline-controls"><span class="selection-inline-status ${selectionState.className}"><span aria-hidden="true">${selectionState.icon}</span><span><strong>${selectionState.label}</strong><small>${selectionState.detail}</small></span></span>${selectionActions(product,sale.products.indexOf(product))}</div>`:'';
  return `<article class="record-product${isSelection?' is-selection-row':''}">
    <img src="${product.image}" alt="${escapeHTML(product.name)}, ${escapeHTML(product.variant)}" />
    <div class="record-product-info"><strong>${escapeHTML(product.name)}</strong><span class="record-variant-mobile">${escapeHTML(color)} · Talla ${escapeHTML(size)}</span><small>${purpose}</small></div>
    <div class="record-color"><span>Color</span><strong>${escapeHTML(color)}</strong></div>
    <div class="record-size"><span>Talla</span><strong>${escapeHTML(size)}</strong></div>
    <div class="record-quantity"><span>Cantidad</span><strong>${quantity}</strong></div>
    <div class="record-unit-price"><span>Precio unitario</span><strong>${money(unitPrice)}</strong></div>
    <div class="record-line-discount ${lineDiscount?'has-discount':''}"><span>Descuento</span><strong>${lineDiscount?`- ${money(lineDiscount)}`:money(0)}</strong></div>
    <div class="record-line-total${isSelection&&!isIncludedInTotal(product)?' selection-total-pending':''}"><span>Total</span><strong>${totalLabel}</strong></div>
    ${selectionControls}
  </article>`;
}

function selectionStatus(product){
  const status=product.selectionStatus||'pending';
  if(status==='kept')return {className:'selection-kept',icon:'✓',label:'La conservó',detail:`Sumada al total de la venta · ${money(product.price)}.`};
  if(status==='rejected'&&product.returnedAt)return {className:'selection-returned',icon:'↩',label:'Devuelta',detail:`No se cobró · regresó físicamente ${product.returnedAt}.`};
  if(status==='rejected')return {className:'selection-rejected',icon:'!',label:'No elegida',detail:'No se cobrará; falta confirmar su regreso físico.'};
  return {className:'selection-pending',icon:'○',label:'Por decidir',detail:`No afecta el total hasta que la clienta la conserve · ${money(product.price)}.`};
}

function selectionActions(product,index){
  const status=product.selectionStatus||'pending';
  if(status==='pending')return `<div class="selection-actions" role="group" aria-label="Decisión para ${escapeHTML(product.name)}"><button class="selection-keep" type="button" data-selection-action="kept" data-product-index="${index}">La conservó</button><button type="button" data-selection-action="rejected" data-product-index="${index}">No la eligió</button></div>`;
  if(status==='rejected'&&!product.returnedAt)return `<div class="selection-actions"><button class="selection-return" type="button" data-selection-action="returned" data-product-index="${index}">Confirmar devolución física</button><button type="button" data-selection-action="reset" data-product-index="${index}">Corregir decisión</button></div>`;
  return `<div class="selection-actions"><button type="button" data-selection-action="reset" data-product-index="${index}">Cambiar decisión</button></div>`;
}

function paymentHistory(){
  const movements=sale.paymentMovements?.length?sale.paymentMovements:(productPaid()?[{recordedAt:sale.date,method:'Efectivo',currency:'NIO',productAmount:productPaid(),shippingAmount:shippingPaid()}]:[]);
  if(!movements.length)return '<div class="record-empty"><strong>Aún no hay pagos registrados</strong><span>Cuando se reciba el primer pago aparecerá aquí.</span></div>';
  return movements.slice().reverse().map(movement=>{const productAmount=roundMoney(movement.productAmount??movement.amount);const shipmentAmount=roundMoney(movement.shippingAmount);const total=roundMoney(productAmount+shipmentAmount);const method=movement.isRefund?'Reembolso':movement.method==='card'?`Tarjeta · ${String(movement.terminal||'Terminal').toUpperCase()}`:movement.method;const exchange=movement.currency==='USD'?`Recibido $ ${Number(movement.amountReceivedUsd||0).toFixed(2)} · tasa ${Number(movement.exchangeRate||0).toFixed(2)}`:'';const audit=movement.correctedAt?` · corregido ${escapeHTML(movement.correctedAt)}`:movement.isRefund&&movement.reason?` · ${escapeHTML(movement.reason)}`:'';const amountLabel=value=>value<0?`− ${money(Math.abs(value))}`:money(value);const actions=movement.id&&!movement.isRefund?`<div class="record-payment-actions" role="group" aria-label="Acciones para ${escapeHTML(method)}"><button class="payment-row-action" type="button" data-payment-action="correct" data-payment-id="${escapeHTML(movement.id)}">Actualizar</button><button class="payment-row-action payment-row-refund" type="button" data-payment-action="refund" data-payment-id="${escapeHTML(movement.id)}">Reembolsar</button></div>`:'';return `<article class="record-payment ${movement.isRefund?'is-refund':''}"><span class="payment-method-icon" aria-hidden="true">${movement.isRefund?'↩':movement.currency==='USD'?'$':'C$'}</span><div class="record-payment-main"><strong>${escapeHTML(method)}</strong><small>${escapeHTML(movement.recordedAt||sale.date)}${exchange?` · ${escapeHTML(exchange)}`:''}${audit}</small><span class="payment-allocation-tags">${productAmount?`<em>Productos ${amountLabel(productAmount)}</em>`:''}${shipmentAmount?`<em>Envío ${amountLabel(shipmentAmount)}</em>`:''}</span></div><strong class="record-payment-amount">${amountLabel(total)}</strong>${actions}</article>`;}).join('');
}

function deliveryCompletion(){
  if(deliveryStatus()==='completed')return '<div class="delivery-complete-note"><span aria-hidden="true">✓</span><strong>Entrega finalizada</strong></div>';
  if(deliveryStatus()!=='delivered-selection')return '';
  const blocked=openSelectionTasks()>0||totalBalance()>0;const pending=pendingDecisions().length;const returns=pendingReturns().length;const balance=totalBalance();
  const selectionReason=`${pending?`${pending} ${pending===1?'decisión pendiente':'decisiones pendientes'}`:''}${pending&&returns?' · ':''}${returns?`${returns} ${returns===1?'devolución sin confirmar':'devoluciones sin confirmar'}`:''}`;
  const reason=blocked?`${selectionReason}${selectionReason&&balance?' · ':''}${balance?`Falta pagar ${money(balance)}`:''}`:'Todas las prendas en selección están resueltas y no hay saldo pendiente.';
  return `<div class="delivery-completion"><button class="primary-action record-wide-action" type="button" id="completeDelivery" ${blocked?'disabled aria-describedby="completionReason"':''}>Finalizar entrega</button><p id="completionReason" class="${blocked?'completion-blocked':''}">${reason}</p></div>`;
}

function deliveryTimeline(){
  const status=deliveryStatus();
  const steps=[
    {key:'ready',label:'Creada',meta:sale.deliveryHistory?.createdAt||'Hoy · 9:40 a. m.'},
    {key:'sent',label:'Despachada',meta:sale.deliveryHistory?.sentAt},
    {key:'outcome',label:status==='failed'?'Fallida':status==='cancelled'?'Cancelada':status==='delivered-selection'?'Recibida':'Entregada',meta:sale.deliveryHistory?.outcomeAt}
  ];
  const rank={none:0,ready:1,sent:2,'delivered-selection':3,completed:3,failed:3,cancelled:3}[status]||0;
  return `<ol class="delivery-timeline" aria-label="Progreso de la entrega">${steps.map((step,index)=>`<li class="${rank>index?'is-complete':rank===index?'is-current':''}"><span aria-hidden="true">${rank>index?'✓':index+1}</span><div><strong>${step.label}</strong><small>${step.meta?escapeHTML(step.meta):'Pendiente'}</small></div></li>`).join('')}</ol>`;
}

function deliveryFacts(){
  const info=deliveryDetails();
  const address=info.deliveryAddress||sale.client?.address||'Dirección registrada en el cliente';
  return `<dl class="delivery-facts">
    <div><dt>Código</dt><dd>${escapeHTML(info.code||'Sin código')}</dd></div>
    <div><dt>Agencia</dt><dd>${escapeHTML(info.agencyName||'Sin asignar')}</dd></div>
    <div><dt>Municipio</dt><dd>${escapeHTML(info.municipalityName||'Sin asignar')}</dd></div>
    <div><dt>Monto de envío</dt><dd>${money(shippingTotal())}</dd></div>
    <div class="delivery-address"><dt>Dirección</dt><dd>${escapeHTML(address)}</dd></div>
    <div class="delivery-address"><dt>Comentario</dt><dd>${escapeHTML(info.comments||'Sin comentarios')}</dd></div>
  </dl>`;
}

function deliveryActions(){
  const status=deliveryStatus();
  if(['none','not-applicable','completed','cancelled'].includes(status))return '';
  const canCancel=status==='ready'&&hasPermission('deliveries.cancel');
  const dispatchBlocked=status==='ready'&&totalBalance()>0;
  const dispatch=status==='ready'&&hasPermission('deliveries.dispatch')?`<button class="primary-action" type="button" data-delivery-action="dispatch" ${dispatchBlocked?'disabled aria-describedby="dispatchBlockReason"':''}>Marcar despachada</button>`:'';
  const outcome=status==='sent'&&hasPermission('deliveries.update-status')?`<button class="primary-action" type="button" data-delivery-action="delivered">Confirmar entrega</button><button class="secondary-action" type="button" data-delivery-action="failed">Registrar entrega fallida</button>`:'';
  const failed=status==='failed'&&hasPermission('deliveries.correct-status')?'<button class="secondary-action" type="button" data-delivery-action="retry">Reprogramar entrega</button>':'';
  return `<div class="delivery-admin"><div class="delivery-admin-heading"><div><strong>Acciones administrativas</strong><small>Disponibles para ${escapeHTML(currentUser.role)}</small></div><span title="Permisos verificados" aria-label="Permisos verificados">✓</span></div><div class="delivery-action-buttons">${dispatch}${outcome}${failed}${canCancel?'<button class="text-danger-action" type="button" data-delivery-action="cancel">Cancelar entrega</button>':''}</div>${dispatchBlocked?`<p class="blocked-note" id="dispatchBlockReason">Falta recibir ${money(totalBalance())} antes de despachar la entrega.</p>`:''}</div>`;
}

function deliverySection(){
  const status=deliveryStatus();const local=isLocalSale();
  if(local||status==='none')return `<section class="record-section"><header><div class="record-section-title"><span class="record-section-icon" aria-hidden="true"><svg><use href="prototype-icons.svg#truck"></use></svg></span><div><h3>${local?'Retiro':'Entrega'}</h3><p>Preparación y seguimiento.</p></div></div><span class="status-badge delivery-none">${deliveryLabels[status]}</span></header><div class="record-delivery"><span aria-hidden="true">${local?'⌂':'▣'}</span><div><strong>${local?'Esta venta se retira en la tienda.':'Todavía no se ha creado una entrega.'}</strong><small>${local?'No requiere agencia ni dirección de envío.':'Créala desde el resumen de la venta para comenzar el seguimiento.'}</small></div></div></section>`;
  const statusNote=status==='failed'&&sale.deliveryHistory?.comment?`<div class="delivery-event-note"><strong>Motivo de la falla</strong><p>${escapeHTML(sale.deliveryHistory.comment)}</p></div>`:status==='cancelled'&&sale.deliveryHistory?.comment?`<div class="delivery-event-note"><strong>Motivo de cancelación</strong><p>${escapeHTML(sale.deliveryHistory.comment)}</p></div>`:'';
  return `<section class="record-section delivery-record-section"><header><div class="record-section-title"><span class="record-section-icon" aria-hidden="true"><svg><use href="prototype-icons.svg#truck"></use></svg></span><div><h3>Entrega</h3><p>Datos completos y seguimiento.</p></div></div><span class="status-badge ${deliveryBadgeClasses[status]||'delivery-none'}">${deliveryLabels[status]}</span></header>${deliveryTimeline()}${deliveryFacts()}${statusNote}${deliveryActions()}${deliveryCompletion()}</section>`;
}

function render(){
  const shipping=shippingTotal();const productDue=productBalance();const shippingDue=shippingBalance();const totalDue=totalBalance();const refundDue=totalRefundDue();
  const products=sale.products.map(productRow).join('');const directCount=directProducts().reduce((sum,product)=>sum+Number(product.quantity||1),0);const selectionCount=selectionProducts().reduce((sum,product)=>sum+Number(product.quantity||1),0);const productSummary=`${directCount} ${directCount===1?'producto':'productos'} incluidos${selectionCount?` · ${selectionCount} en selección`:''}`;
  const itemsCannotBeEdited=!hasPermission('sales.edit-items')||!editableItems();
  const deliveryAction=deliveryStatus()==='none'&&!isLocalSale()&&!isSaleCancelled()
    ?`<button class="secondary-action financial-secondary-action" type="button" id="createDelivery" ${sale.client?String():'disabled'}>Crear entrega</button>`
    :deliveryStatus()==='ready'&&hasPermission('deliveries.edit')
      ?'<button class="secondary-action financial-secondary-action" type="button" id="editDelivery">Editar entrega</button>'
      :'';
  const financialState=refundDue?'refund':totalDue?'pending':'paid';
  document.querySelector('#recordTitle').textContent=`Venta #${sale.id}`;
  content.innerHTML=`
    <section class="record-overview" aria-label="Información general de la venta">${saleMetaEditor()}</section>
    <div class="record-layout"><div class="record-main">
      <section class="record-section products-record-section"><header><div class="record-section-title"><span class="record-section-icon" aria-hidden="true"><svg><use href="prototype-icons.svg#package"></use></svg></span><div><h3>Productos</h3><p>${productSummary}</p></div></div><button class="secondary-action product-edit-action" type="button" data-edit-products ${itemsCannotBeEdited?'disabled title="Los productos ya no pueden modificarse"':''}>Editar<span class="product-edit-wide"> productos</span></button></header><div class="record-product-columns" aria-hidden="true"><span>Producto</span><span>Color</span><span>Talla</span><span>Cant.</span><span>Precio</span><span>Descuento</span><span>Total</span></div><div class="record-products">${products||'<div class="record-empty"><strong>Sin productos</strong><span>Agrega productos para continuar con la venta.</span></div>'}</div><dl class="record-totals"><div><dt>Subtotal</dt><dd>${money(sale.total+sale.discount)}</dd></div><div class="discount"><dt>Descuento</dt><dd>${sale.discount?`- ${money(sale.discount)}`:money(0)}</dd></div><div><dt>Total de productos</dt><dd>${money(sale.total)}</dd></div></dl></section>
      <section class="record-section payments-record-section"><header><div class="record-section-title"><span class="record-section-icon" aria-hidden="true"><svg><use href="prototype-icons.svg#receipt"></use></svg></span><div><h3>Pagos</h3><p>Movimientos recibidos y su aplicación.</p></div></div></header><div class="payment-balance-strip"><div><span>Aplicado a productos</span><strong>${money(productPaid())}</strong><small>de ${money(sale.total)}</small></div><div><span>Aplicado al envío</span><strong>${money(shippingPaid())}</strong><small>de ${shipping?money(shipping):money(0)}</small></div><div class="${refundDue?'has-refund':totalDue?'has-balance':'is-paid'}"><span>${refundDue?'Por reembolsar':'Pendiente'}</span><strong>${money(refundDue||totalDue)}</strong><small>${refundDue?'Excedente recibido':totalDue?'Saldo por cobrar':'Venta pagada'}</small></div></div><div class="record-history"><div class="record-history-heading"><h4>Movimientos</h4><span>${sale.paymentMovements?.length||0} registrados</span></div>${paymentHistory()}</div></section>
    </div><aside class="record-side">
      <section class="financial-rail financial-${financialState}" aria-label="Resumen y acciones de la venta"><div class="financial-rail-head"><span>${refundDue?'Excedente por devolver':totalDue?'Saldo pendiente':'Venta pagada'}</span><strong>${money(refundDue||totalDue)}</strong><small>${refundDue?'Requiere registrar un reembolso':totalDue?`de ${money(sale.total+shipping)}`:'No hay saldo por cobrar'}</small></div><dl class="financial-rail-summary"><div><dt>Productos</dt><dd>${money(sale.total)}</dd></div><div><dt>Envío</dt><dd>${shipping?money(shipping):money(0)}</dd></div><div><dt>Total</dt><dd>${money(sale.total+shipping)}</dd></div><div><dt>Pagado</dt><dd>${money(productPaid()+shippingPaid())}</dd></div></dl><div class="financial-rail-actions">${!isSaleCancelled()&&totalDue&&!refundDue?'<button class="primary-action" type="button" id="registerPayment">Registrar pago</button>':''}${deliveryAction}</div><div class="financial-rail-note"><span aria-hidden="true">${deliveryStatus()==='none'?'○':'✓'}</span><div><strong>${deliveryStatus()==='none'?'Entrega sin crear':deliveryLabels[deliveryStatus()]}</strong><small>${deliveryStatus()==='none'?'Puedes prepararla desde este panel.':'Consulta el seguimiento más abajo.'}</small></div></div></section>
      <section class="record-section customer-record-section"><header><div class="record-section-title"><span class="record-section-icon" aria-hidden="true"><svg><use href="prototype-icons.svg#users"></use></svg></span><div><h3>Cliente</h3></div></div><button class="secondary-action" type="button" data-edit-sale-client>${sale.client?'Cambiar':'Asignar cliente'}</button></header>${sale.client?`<dl class="customer-details"><div><dt>Nombre</dt><dd>${escapeHTML(sale.client.name)}</dd></div><div><dt>Teléfono</dt><dd>${sale.client.phone?`<a href="tel:${escapeHTML(String(sale.client.phone).replace(/\s/g,''))}">${escapeHTML(sale.client.phone)}</a>`:'Sin teléfono registrado'}</dd></div>${sale.client.instagram?`<div><dt>Instagram</dt><dd>${escapeHTML(sale.client.instagram)}</dd></div>`:''}${sale.client.messenger?`<div><dt>Messenger</dt><dd>${escapeHTML(sale.client.messenger)}</dd></div>`:''}${sale.client.address?`<div><dt>Dirección</dt><dd>${escapeHTML(sale.client.address)}</dd></div>`:''}</dl>`:'<div class="record-empty"><strong>Sin cliente asociado</strong><span>Agrega un cliente antes de crear una entrega.</span></div>'}</section>
      ${deliverySection()}
    </aside></div>`;
}

function addAdminAudit(label,reason,icon='✓'){
  sale.adminCorrections??=[];sale.adminCorrections.push({label,reason,icon,at:'Hoy · ahora',by:currentUser.name});
}

function openAdminProducts(){
  if(!hasPermission('sales.edit-items')||!editableItems()){showToast('Las prendas no pueden modificarse en el estado actual.');return;}
  persistSale();location.href=`sale-correction.html?id=${encodeURIComponent(sale.id)}`;
}

const paymentMethodKey=movement=>movement.method==='card'||String(movement.method||'').toLowerCase()==='tarjeta'?'card':String(movement.method||'').toLowerCase()==='transferencia'||movement.method==='transfer'?'transfer':'cash';
const paymentMethodLabel={cash:'Efectivo',transfer:'Transferencia',card:'Tarjeta'};
function movementReceivedAmount(movement){
  const stored=movement.currency==='USD'?movement.amountReceivedUsd:movement.amountReceivedNio;
  if(Number(stored)>0)return Number(stored);
  const applied=roundMoney(Number(movement.productAmount||0)+Number(movement.shippingAmount||0));
  return movement.currency==='USD'&&Number(movement.exchangeRate)>0?roundMoney(applied/Number(movement.exchangeRate)):applied;
}

function updateAdminPaymentMethodFields(){
  const isCard=adminPaymentForm.elements.method.value==='card';
  const terminalField=document.querySelector('#adminPaymentTerminalField');
  terminalField.hidden=!isCard;
  adminPaymentForm.elements.terminal.required=isCard;
  if(!isCard)adminPaymentForm.elements.terminal.value='';
}

function convertPaymentAmount(amount,fromCurrency,toCurrency,rate){
  if(!amount||fromCurrency===toCurrency)return roundMoney(amount);
  const exchangeRate=Number(rate)||36.62;
  return roundMoney(fromCurrency==='USD'?amount*exchangeRate:amount/exchangeRate);
}

function updateAdminPaymentCurrency(){
  const movement=sale.paymentMovements?.find(entry=>entry.id===adminPaymentForm.elements.movementId.value);
  const nextCurrency=adminPaymentForm.elements.currency.value;
  const previousCurrency=adminPaymentForm.dataset.paymentCurrency;
  const rate=Number(movement?.exchangeRate)||36.62;
  const amount=Number(adminPaymentForm.elements.amount.value);
  if(movement&&previousCurrency&&previousCurrency!==nextCurrency&&amount>0){
    adminPaymentForm.elements.amount.value=convertPaymentAmount(amount,previousCurrency,nextCurrency,rate).toFixed(2);
  }
  adminPaymentForm.dataset.paymentCurrency=nextCurrency;
  const unit=nextCurrency==='USD'?'$':'C$';
  document.querySelector('#adminPaymentAmountUnit').textContent=unit;
  document.querySelector('#adminPaymentAmountPrefix').textContent=unit;
}

function updatePaymentCorrectionFields(){
  const movement=sale.paymentMovements?.find(entry=>entry.id===adminPaymentForm.elements.movementId.value);
  if(!movement)return;
  const currency=movement.currency==='USD'?'USD':'NIO';
  adminPaymentForm.elements.method.value=paymentMethodKey(movement);
  adminPaymentForm.elements.terminal.value=movement.terminal||'';
  adminPaymentForm.elements.currency.value=currency;
  adminPaymentForm.elements.amount.value=movementReceivedAmount(movement).toFixed(2);
  adminPaymentForm.dataset.paymentCurrency=currency;
  updateAdminPaymentCurrency();
  updateAdminPaymentMethodFields();
}

function openAdminPayment(movementId){
  if(!hasPermission('payments.correct-nio')||!correctableMovements().length||isSaleCancelled()){showToast('No hay pagos disponibles para actualizar.');return;}
  adminPaymentForm.reset();document.querySelector('#adminPaymentError').textContent='';
  adminPaymentForm.elements.movementId.innerHTML=correctableMovements().map(movement=>`<option value="${escapeHTML(movement.id)}">${escapeHTML(movement.id)} · ${escapeHTML(paymentMethodLabel[paymentMethodKey(movement)]||movement.method||'Pago')} · ${movement.currency==='USD'?'$':'C$'} ${money(roundMoney(Number(movement.productAmount||0)+Number(movement.shippingAmount||0))).replace('C$ ','')}</option>`).join('');
  if(movementId&&correctableMovements().some(movement=>movement.id===movementId))adminPaymentForm.elements.movementId.value=movementId;
  updatePaymentCorrectionFields();adminPaymentDialog.showModal();adminPaymentForm.elements.method.focus();
}

function refundTargetMovement(){return refundTargetMovementId?sale.paymentMovements?.find(movement=>movement.id===refundTargetMovementId&&!movement.isRefund):null;}
function refundedFromMovement(movementId,allocation){return roundMoney((sale.paymentMovements||[]).filter(movement=>movement.isRefund&&movement.sourceMovementId===movementId).reduce((sum,movement)=>sum+Math.abs(Number(allocation==='shipping'?movement.shippingAmount:movement.productAmount)||0),0));}
function refundAvailableFor(allocation){const target=refundTargetMovement();if(target){const original=Number(allocation==='shipping'?target.shippingAmount:target.productAmount)||0;return Math.max(0,roundMoney(original-refundedFromMovement(target.id,allocation)));}return allocation==='shipping'?shippingPaid():productPaid();}
function refundAvailableTotal(){return roundMoney(refundAvailableFor('products')+refundAvailableFor('shipping'));}
function refundAllocation(amount){const productAvailable=refundAvailableFor('products');const productAmount=roundMoney(Math.min(amount,productAvailable));const shippingAmount=roundMoney(Math.min(Math.max(0,amount-productAmount),refundAvailableFor('shipping')));return {productAmount,shippingAmount};}
function updateRefundAvailable(){
  const available=refundAvailableTotal();
  document.querySelector('#refundAvailable').textContent=money(available);adminRefundForm.elements.amount.max=String(available);adminRefundForm.elements.amount.value=available?available.toFixed(2):'';
}

function openAdminRefund(movementId){
  if(!hasPermission('payments.refund')||netPaid()<=0){showToast('No hay dinero disponible para reembolsar.');return;}
  refundTargetMovementId=movementId||null;
  if(refundTargetMovementId&&!refundTargetMovement()){refundTargetMovementId=null;showToast('No se encontró el pago seleccionado.');return;}
  adminRefundForm.reset();document.querySelector('#adminRefundError').textContent='';
  updateRefundAvailable();adminRefundDialog.showModal();adminRefundForm.elements.amount.focus();
}

function openAdminCancellation(){
  const blockers=cancellationBlockers();if(!hasPermission('sales.cancel')||blockers.length){showToast(blockers[0]||'No tienes permiso para cancelar esta venta.');return;}
  adminCancelForm.reset();adminCancelDialog.showModal();adminCancelForm.elements.reason.focus();
}

function calculateExistingPayment(){
  const received=Number(existingPaymentReceived.value);const rate=Number(existingExchangeRate.value);const balances=paymentBalances();const balance=balances.total;
  if(!received||received<=0||(existingPaymentCurrency.value==='USD'&&(!rate||rate<=0)))return null;
  const converted=existingPaymentCurrency.value==='USD'?received*rate:received;const amount=roundMoney(Math.min(converted,balance));
  let change=roundMoney(Math.max(0,converted-amount));
  if(existingPaymentCurrency.value==='USD'&&converted>=balance&&change<=.5)change=0;
  const productAmount=roundMoney(Math.min(amount,balances.products));const shippingAmount=roundMoney(Math.min(amount-productAmount,balances.shipping));
  return {received,rate,converted,balance,amount,productAmount,shippingAmount,change,exchangeDifferenceNio:existingPaymentCurrency.value==='USD'?roundMoney(converted-change-amount):0};
}
function renderExistingPaymentCalculation(){
  const calculation=calculateExistingPayment();existingPaymentCalculation.hidden=!calculation;
  if(!calculation)return;
  document.querySelector('#existingReceivedValueNio').textContent=money(roundMoney(calculation.converted));document.querySelector('#existingProductAppliedPreview').textContent=money(calculation.productAmount);document.querySelector('#existingShippingAppliedPreview').textContent=money(calculation.shippingAmount);document.querySelector('#existingAppliedPreview').textContent=money(calculation.amount);document.querySelector('#existingChangePreview').textContent=money(calculation.change);
}
function updateExistingPaymentCurrency(){
  const isCard=existingPaymentMethod.value==='card';const acceptsUsd=!isCard;if(!acceptsUsd)existingPaymentCurrency.value='NIO';existingPaymentCurrency.disabled=!acceptsUsd;existingTerminalField.hidden=!isCard;existingPaymentTerminal.required=isCard;
  const isUsd=existingPaymentCurrency.value==='USD';const isTransfer=existingPaymentMethod.value==='transfer';existingExchangeRateField.hidden=!isUsd;document.querySelector('#existingReceivedLabel').textContent=isTransfer?'Monto transferido':'Monto recibido';document.querySelector('#existingReceivedUnit').textContent=isUsd?'$':'C$';existingPaymentReceived.value='';document.querySelector('#existingPaymentError').textContent='';renderExistingPaymentCalculation();
}
existingPaymentMethod.addEventListener('change',updateExistingPaymentCurrency);existingPaymentCurrency.addEventListener('change',updateExistingPaymentCurrency);existingPaymentReceived.addEventListener('input',renderExistingPaymentCalculation);existingExchangeRate.addEventListener('input',renderExistingPaymentCalculation);
paymentForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;event.preventDefault();const calculation=calculateExistingPayment();const error=document.querySelector('#existingPaymentError');
  if(!calculation){error.textContent=existingPaymentCurrency.value==='USD'?'Ingresa un monto recibido y una tasa de cambio válidos.':'Ingresa el monto que entregó la clienta.';existingPaymentReceived.focus();return;}if(existingPaymentMethod.value==='card'&&!existingPaymentTerminal.value){error.textContent='Selecciona la terminal que procesó el pago.';existingPaymentTerminal.focus();return;}
  sale.paymentMovements??=[];sale.paymentMovements.push({id:`P-${String(Date.now()).slice(-4)}`,recordedAt:'Ahora',method:existingPaymentMethod.value==='card'?'card':existingPaymentMethod.selectedOptions[0].textContent,terminal:existingPaymentMethod.value==='card'?existingPaymentTerminal.value:undefined,currency:existingPaymentCurrency.value,productAmount:calculation.productAmount,shippingAmount:calculation.shippingAmount,amountReceivedNio:existingPaymentCurrency.value==='NIO'?calculation.received:undefined,amountReceivedUsd:existingPaymentCurrency.value==='USD'?calculation.received:undefined,exchangeRate:existingPaymentCurrency.value==='USD'?calculation.rate:undefined,changeGivenNio:calculation.change});sale.productPaid=roundMoney(productPaid()+calculation.productAmount);sale.paid=sale.productPaid;sale.shippingPaid=roundMoney(shippingPaid()+calculation.shippingAmount);sale.payment=sale.productPaid>=sale.total?'paid':'partial';persistSale();paymentDialog.close('saved');render();showToast(calculation.change>0?`Pago registrado. Entrega ${money(calculation.change)} de cambio.`:`Pago de ${money(calculation.amount)} registrado en la venta #${sale.id}.`);
});
content.addEventListener('submit',event=>{
  const form=event.target.closest('#saleMetaForm');
  if(form){event.preventDefault();saveSaleMeta(form);}
});
content.addEventListener('click',event=>{
  if(event.target.closest('[data-edit-sale-client]')){openClientDialog();return;}
  if(event.target.closest('#registerPayment')){if(sale.saleStatus==='cancelled'){showToast('No se pueden registrar pagos en una venta cancelada.');return;}paymentForm.reset();const balances=paymentBalances();document.querySelector('#paymentHelp').innerHTML=`<span><small>Productos</small><strong>${money(balances.products)}</strong></span><span><small>Envío</small><strong>${money(balances.shipping)}</strong></span><span><small>Total pendiente</small><strong>${money(balances.total)}</strong></span>`;document.querySelector('#existingPaymentError').textContent='';updateExistingPaymentCurrency();paymentDialog.showModal();existingPaymentMethod.focus();}
  if(event.target.closest('#createDelivery')){if(sale.saleStatus==='cancelled'){showToast('No se puede crear una entrega para una venta cancelada.');return;}if(isLocalSale(sale)){showToast('Las ventas locales no pueden tener envíos.');return;}if(!sale.client){showToast('Agrega un cliente antes de crear la entrega.');return;}const form=document.querySelector('#deliveryForm');form.reset();form.elements.contactPhone.value=sale.client.phone;form.elements.code.value=`DEL-${sale.id.replace(/\D/g,'')}`;deliveryDialog.showModal();form.elements.deliveryAgencyId.focus();}
  if(event.target.closest('#adminEditProducts, [data-edit-products]')){openAdminProducts();return;}
  const paymentAction=event.target.closest('[data-payment-action]');
  if(paymentAction){const movementId=paymentAction.dataset.paymentId;paymentAction.dataset.paymentAction==='correct'?openAdminPayment(movementId):openAdminRefund(movementId);return;}
  if(event.target.closest('#adminCorrectPayment')){openAdminPayment();return;}
  if(event.target.closest('#adminRefundPayment')){openAdminRefund();return;}
  if(event.target.closest('#adminCancelSale')){openAdminCancellation();return;}
  if(event.target.closest('#editDelivery')){
    if(deliveryStatus()!=='ready'||!hasPermission('deliveries.edit')){showToast('Esta entrega ya no puede editarse.');return;}
    const info=deliveryDetails();deliveryEditForm.reset();
    deliveryEditForm.elements.deliveryAgencyId.value=String(info.deliveryAgencyId||1);
    deliveryEditForm.elements.municipalityId.value=String(info.municipalityId||1);
    deliveryEditForm.elements.code.value=info.code||'';
    deliveryEditForm.elements.shippingChargedToClient.value=Number(info.shippingChargedToClient||0).toFixed(2);
    deliveryEditForm.elements.deliveryAddress.value=info.deliveryAddress||'';
    deliveryEditForm.elements.comments.value=info.comments||'';
    deliveryEditDialog.showModal();deliveryEditForm.elements.deliveryAgencyId.focus();return;
  }
  const deliveryButton=event.target.closest('[data-delivery-action]');
  if(deliveryButton){openDeliveryAction(deliveryButton.dataset.deliveryAction);return;}
  const actionButton=event.target.closest('[data-selection-action]');
  if(actionButton){
    const product=sale.products[Number(actionButton.dataset.productIndex)];const action=actionButton.dataset.selectionAction;
    if(action==='kept'){setProductIncluded(product,true);product.selectionStatus='kept';product.returnedAt=null;showToast(`${product.name} se sumó al total por ${money(product.price)}.`);}
    if(action==='rejected'){setProductIncluded(product,false);product.selectionStatus='rejected';product.returnedAt=null;showToast(`${product.name}: marcada como no elegida y sin cargo.`);}
    if(action==='returned'){product.returnedAt='Hoy · ahora';showToast(`Devolución física de ${product.name} confirmada.`);}
    if(action==='reset'){setProductIncluded(product,false);product.selectionStatus='pending';product.returnedAt=null;showToast(`La decisión de ${product.name} quedó pendiente y se retiró del total.`);}
    persistSale();render();return;
  }
  if(event.target.closest('#completeDelivery')){
    if(openSelectionTasks()){showToast('Resuelve las decisiones y devoluciones antes de finalizar.');return;}
    if(totalBalance()>0){showToast(`Falta pagar ${money(totalBalance())} antes de finalizar.`);return;}
    sale.delivery='completed';persistSale();render();showToast(`La entrega de la venta #${sale.id} fue finalizada.`);
  }
});

clientSearchInput.addEventListener('input',renderClientSearch);
clientSearchResults.addEventListener('click',event=>{
  const result=event.target.closest('[data-client-result]');if(!result)return;
  selectedClientId=result.dataset.clientResult;renderClientSearch();
});
clientDialogForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;
  event.preventDefault();
  if(!selectedClientId){clientSearchInput.focus();return;}
  saveSelectedClient();
});
clientDialog.addEventListener('close',()=>{selectedClientId='';});


function calculateCorrectedPayment(movement,received){
  const previousProduct=roundMoney(Number(movement.productAmount||0));
  const previousShipping=roundMoney(Number(movement.shippingAmount||0));
  const balances={products:Math.max(0,roundMoney(sale.total-(productPaid()-previousProduct))),shipping:Math.max(0,roundMoney(shippingTotal()-(shippingPaid()-previousShipping)))};
  const rate=movement.currency==='USD'?Number(movement.exchangeRate||0):1;
  if(!received||received<=0||(movement.currency==='USD'&&(!rate||rate<=0)))return null;
  const converted=movement.currency==='USD'?roundMoney(received*rate):roundMoney(received);
  const amount=roundMoney(Math.min(converted,balances.products+balances.shipping));
  const productAmount=roundMoney(Math.min(amount,balances.products));
  const shippingAmount=roundMoney(Math.min(amount-productAmount,balances.shipping));
  return {received,converted,productAmount,shippingAmount,change:roundMoney(Math.max(0,converted-amount))};
}

adminPaymentForm.elements.movementId.addEventListener('change',updatePaymentCorrectionFields);
adminPaymentForm.elements.method.addEventListener('change',updateAdminPaymentMethodFields);
adminPaymentForm.elements.currency.addEventListener('change',updateAdminPaymentCurrency);
adminPaymentForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='save')return;
  event.preventDefault();const error=document.querySelector('#adminPaymentError');error.textContent='';
  const movement=sale.paymentMovements?.find(entry=>entry.id===adminPaymentForm.elements.movementId.value);
  if(!movement||movement.isRefund){error.textContent='Selecciona un pago válido.';return;}
  const method=adminPaymentForm.elements.method.value;const terminal=adminPaymentForm.elements.terminal.value;const currency=adminPaymentForm.elements.currency.value;const amount=roundMoney(Number(adminPaymentForm.elements.amount.value));
  if(method==='card'&&!terminal){error.textContent='Selecciona la terminal que procesó el pago.';return;}
  if(method==='card'&&currency==='USD'){error.textContent='Los pagos con tarjeta deben registrarse en córdobas.';return;}
  const calculation=calculateCorrectedPayment({...movement,currency},amount);
  if(!calculation){error.textContent='Ingresa un monto válido para este pago.';return;}
  const previousProduct=roundMoney(Number(movement.productAmount||0));const previousShipping=roundMoney(Number(movement.shippingAmount||0));
  const correctedProduct=roundMoney(productPaid()-previousProduct+calculation.productAmount);const correctedShipping=roundMoney(shippingPaid()-previousShipping+calculation.shippingAmount);
  movement.method=method==='card'?'card':paymentMethodLabel[method];movement.terminal=method==='card'?terminal:undefined;movement.currency=currency;movement.exchangeRate=currency==='USD'?Number(movement.exchangeRate)||36.62:undefined;movement.productAmount=calculation.productAmount;movement.shippingAmount=calculation.shippingAmount;movement.amountReceivedNio=currency==='USD'?undefined:calculation.received;movement.amountReceivedUsd=currency==='USD'?calculation.received:undefined;movement.changeGivenNio=calculation.change;movement.correctedAt='Hoy · ahora';
  sale.productPaid=correctedProduct;sale.paid=correctedProduct;sale.shippingPaid=correctedShipping;sale.payment=productPaid()>=sale.total?'paid':'partial';
  addAdminAudit(`Pago ${movement.id} actualizado`,'','✎');persistSale();adminPaymentDialog.close('saved');render();showToast('El pago fue actualizado.');
});

adminRefundForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='refund')return;
  event.preventDefault();const error=document.querySelector('#adminRefundError');error.textContent='';
  const amount=roundMoney(Number(adminRefundForm.elements.amount.value));const available=refundAvailableTotal();
  if(amount<=0||amount>available){error.textContent=`El reembolso debe estar entre C$ 0.01 y ${money(available)}.`;return;}
  const allocation=refundAllocation(amount);const productAmount=-allocation.productAmount;const shipmentAmount=-allocation.shippingAmount;
  sale.paymentMovements??=[];sale.paymentMovements.push({id:`R-${String(Date.now()).slice(-4)}`,recordedAt:'Hoy · ahora',method:'Reembolso',currency:'NIO',productAmount,shippingAmount:shipmentAmount,isRefund:true,sourceMovementId:refundTargetMovementId||undefined});
  sale.productPaid=roundMoney(productPaid()+productAmount);sale.paid=sale.productPaid;sale.shippingPaid=roundMoney(shippingPaid()+shipmentAmount);sale.payment=productPaid()>=sale.total?'paid':'partial';
  addAdminAudit(`Reembolso de ${money(amount)}`,'','↩');refundTargetMovementId=null;persistSale();adminRefundDialog.close('refunded');render();showToast(`Reembolso de ${money(amount)} registrado.`);
});

adminRefundDialog.addEventListener('close',()=>{refundTargetMovementId=null;});

adminCancelForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='confirm')return;
  event.preventDefault();const blockers=cancellationBlockers();if(blockers.length){adminCancelDialog.close('blocked');render();showToast(blockers[0]);return;}
  const reason=adminCancelForm.elements.reason.value.trim();if(!reason)return;
  sale.saleStatus='cancelled';sale.cancelledAt='Hoy · ahora';sale.cancelReason=reason;sale.payment='cancelled';
  addAdminAudit('Venta cancelada',reason,'×');persistSale();adminCancelDialog.close('cancelled');render();showToast(`La venta #${sale.id} fue cancelada.`);
});

function openDeliveryAction(action){
  const definitions={
    dispatch:{title:'Confirmar despacho',summary:'La entrega pasará a seguimiento con la agencia.',help:totalBalance()?`Falta recibir ${money(totalBalance())} antes de despachar.`:'La entrega está lista para salir.',confirm:'Sí, despachar'},
    delivered:{title:'Confirmar recepción',summary:'Registra que la clienta recibió físicamente el paquete.',help:openSelectionTasks()?'La entrega quedará como “Entregada · selección pendiente” hasta resolver las prendas.':'La entrega quedará finalizada.',confirm:'Confirmar recepción'},
    failed:{title:'Registrar entrega fallida',summary:'La agencia no pudo completar la entrega.',help:'Podrás reprogramarla posteriormente. Agrega el motivo para conservar la trazabilidad.',confirm:'Registrar falla'},
    retry:{title:'Reprogramar entrega',summary:'La entrega regresará al estado pendiente.',help:'Podrás editar los datos y volver a despacharla.',confirm:'Reprogramar'},
    cancel:{title:'Cancelar entrega',summary:'La asignación se cancelará antes del despacho.',help:'La venta y sus pagos no se cancelarán. Esta acción quedará registrada.',confirm:'Cancelar entrega'}
  };
  const definition=definitions[action];if(!definition)return;
  pendingDeliveryAction=action;deliveryActionForm.reset();
  document.querySelector('#deliveryActionTitle').textContent=definition.title;
  document.querySelector('#deliveryActionSummary').textContent=definition.summary;
  document.querySelector('#deliveryActionHelp').textContent=definition.help;
  const confirm=document.querySelector('#deliveryActionConfirm');confirm.textContent=definition.confirm;
  confirm.classList.toggle('danger-confirm',['failed','cancel'].includes(action));
  document.querySelector('#deliveryActionCommentField').hidden=!['failed','cancel','retry'].includes(action);
  deliveryActionDialog.showModal();confirm.focus();
}

deliveryDialog.addEventListener('close',()=>{if(deliveryDialog.returnValue!=='save')return;if(isLocalSale(sale)){showToast('Las ventas locales no pueden tener envíos.');persistSale();render();return;}if(!sale.client){showToast('Agrega un cliente antes de crear la entrega.');render();return;}const form=document.querySelector('#deliveryForm');const agency=form.elements.deliveryAgencyId.selectedOptions[0];const municipality=form.elements.municipalityId.selectedOptions[0];sale.deliveryDetails={code:form.elements.code.value.trim(),municipalityId:Number(form.elements.municipalityId.value),municipalityName:municipality.textContent,deliveryAgencyId:Number(form.elements.deliveryAgencyId.value),agencyName:agency.textContent,shippingChargedToClient:Number(form.elements.shippingChargedToClient.value),deliveryAddress:form.elements.deliveryAddress.value.trim()||undefined,comments:form.elements.comments.value.trim()||undefined};sale.deliveryHistory={createdAt:'Hoy · ahora'};sale.delivery='ready';persistSale();render();showToast(`Entrega creada para la venta #${sale.id}.`);});
deliveryEditDialog.addEventListener('close',()=>{
  if(deliveryEditDialog.returnValue!=='save')return;
  if(deliveryStatus()!=='ready'||!hasPermission('deliveries.edit')){showToast('La entrega cambió de estado y ya no puede editarse.');return;}
  const form=deliveryEditForm.elements;const shipping=roundMoney(Number(form.shippingChargedToClient.value));
  if(shipping<shippingPaid()){showToast(`El monto de envío no puede ser menor a lo ya pagado (${money(shippingPaid())}).`);return;}
  const agency=form.deliveryAgencyId.selectedOptions[0];const municipality=form.municipalityId.selectedOptions[0];
  sale.deliveryDetails={...deliveryDetails(),deliveryAgencyId:Number(form.deliveryAgencyId.value),agencyName:agency.textContent,municipalityId:Number(form.municipalityId.value),municipalityName:municipality.textContent,code:form.code.value.trim(),shippingChargedToClient:shipping,deliveryAddress:form.deliveryAddress.value.trim()||undefined,comments:form.comments.value.trim()||undefined};
  persistSale();render();showToast('Los datos de la entrega fueron actualizados.');
});

deliveryActionDialog.addEventListener('close',()=>{
  if(deliveryActionDialog.returnValue!=='confirm'||!pendingDeliveryAction)return;
  const action=pendingDeliveryAction;pendingDeliveryAction=null;const comment=deliveryActionForm.elements.comment.value.trim();
  sale.deliveryHistory??={};
  if(action==='dispatch'){
    if(!hasPermission('deliveries.dispatch')||deliveryStatus()!=='ready')return;
    if(totalBalance()>0){showToast(`Falta recibir ${money(totalBalance())} antes de despachar la entrega.`);return;}
    sale.delivery='sent';sale.deliveryHistory.sentAt='Hoy · ahora';showToast('Entrega marcada como despachada.');
  }
  if(action==='delivered'){
    if(!hasPermission('deliveries.update-status')||deliveryStatus()!=='sent')return;
    sale.delivery=openSelectionTasks()>0?'delivered-selection':'completed';sale.deliveryHistory.outcomeAt='Hoy · ahora';
    showToast(sale.delivery==='delivered-selection'?'Recepción confirmada; falta resolver la selección.':'Entrega completada.');
  }
  if(action==='failed'){
    if(!hasPermission('deliveries.update-status')||deliveryStatus()!=='sent')return;
    sale.delivery='failed';sale.deliveryHistory.outcomeAt='Hoy · ahora';sale.deliveryHistory.comment=comment||'No se indicó un motivo.';showToast('La entrega fue registrada como fallida.');
  }
  if(action==='retry'){
    if(!hasPermission('deliveries.correct-status')||deliveryStatus()!=='failed')return;
    sale.delivery='ready';sale.deliveryHistory={...sale.deliveryHistory,sentAt:null,outcomeAt:null,comment:comment||undefined};showToast('La entrega quedó pendiente para reprogramación.');
  }
  if(action==='cancel'){
    if(!hasPermission('deliveries.cancel')||deliveryStatus()!=='ready')return;
    sale.delivery='cancelled';sale.deliveryHistory.outcomeAt='Hoy · ahora';sale.deliveryHistory.comment=comment||'Cancelada por administración.';showToast('La entrega fue cancelada; la venta permanece activa.');
  }
  persistSale();render();
});

window.history.scrollRestoration='manual';
addEventListener('pageshow',()=>scrollTo({top:0,left:0,behavior:'auto'}));
const themeButton=document.querySelector('.theme-button');
function setTheme(theme){root.dataset.theme=theme;const dark=theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Activar modo claro':'Activar modo oscuro');themeButton.querySelector('.theme-label').textContent=dark?'Modo claro':'Modo oscuro';localStorage.setItem('pw-theme',theme);}
setTheme(localStorage.getItem('pw-theme')||'light');
themeButton.addEventListener('click',()=>setTheme(root.dataset.theme==='dark'?'light':'dark'));
render();
