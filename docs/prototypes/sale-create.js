const catalog=[
  {id:'dress',name:'Vestido Midi Floral',sku:'VW-VD-001',listPrice:1490,price:1290,campaignName:'Flores de temporada',image:'../../assets/catalog/coral-satin-dress.png',variants:[{color:'Rosa',sizes:{S:7,M:12,L:4}},{color:'Coral',sizes:{S:5,M:9,L:3}}]},
  {id:'blouse',name:'Blusa Satinada Manga Larga',sku:'VW-BL-045',price:890,image:'../../assets/catalog/blouse-champagne.png',variants:[{color:'Marfil',sizes:{S:8,M:6,L:2}},{color:'Champán',sizes:{S:4,M:7,L:3}}]},
  {id:'pants',name:'Pantalón Palazzo Lino',sku:'VW-PA-023',listPrice:1290,price:1190,campaignName:'Especial de julio',image:'../../assets/catalog/blue-jeans.png',variants:[{color:'Negro',sizes:{S:3,M:5,L:5}},{color:'Azul',sizes:{S:6,M:8,L:4}}]},
  {id:'skirt',name:'Falda Plisada',sku:'VW-FA-018',price:740,image:'../../assets/catalog/black-skirt.png',variants:[{color:'Negro',sizes:{S:9,M:6,L:2}}]}
];
const clients=[
  {id:'C-101',name:'Ana Martínez',phone:'+505 8888 2200',address:'Residencial Las Colinas, tercera entrada, del parque central dos cuadras al sur y media cuadra al este, casa color crema, Managua'},
  {id:'C-102',name:'María López',phone:'+505 8756 4321',address:'Altamira, Managua'},
  {id:'C-103',name:'Sofía Gómez',phone:'+505 8547 1122',address:''}
];

let items=[
  {uid:1,productId:'dress',color:'Rosa',size:'M',quantity:1,purpose:'direct',discount:0,discountType:'percent',discountValue:0},
  {uid:2,productId:'blouse',color:'Marfil',size:'S',quantity:1,purpose:'selection',discount:0,discountType:'percent',discountValue:0},
  {uid:3,productId:'pants',color:'Negro',size:'L',quantity:1,purpose:'direct',discount:0,discountType:'percent',discountValue:0}
];
let payments=[];
let activeDiscountUid=null;
let activeDiscountTrigger=null;
let nextUid=4;
let selectedClient=null;

const money=value=>`C$ ${value.toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const productFor=item=>catalog.find(product=>product.id===item.productId);
const stockFor=item=>productFor(item).variants.find(variant=>variant.color===item.color)?.sizes[item.size]??0;
const lineSubtotal=item=>productFor(item).price*item.quantity;
const lineRegularSubtotal=item=>(productFor(item).listPrice??productFor(item).price)*item.quantity;
const manualDiscountBase=item=>productFor(item).listPrice??productFor(item).price;
const lineCampaignDiscount=item=>item.discount?0:Math.max(0,lineRegularSubtotal(item)-lineSubtotal(item));
const lineManualDiscount=item=>Math.min(lineRegularSubtotal(item),item.discount*item.quantity);
const lineTotal=item=>Math.max(0,lineRegularSubtotal(item)-lineCampaignDiscount(item)-lineManualDiscount(item));
const unitSalePrice=item=>lineTotal({...item,quantity:1});
const billableItems=()=>items.filter(item=>item.purpose==='direct');
const subtotal=()=>billableItems().reduce((sum,item)=>sum+lineRegularSubtotal(item),0);
const campaignDiscounts=()=>billableItems().reduce((sum,item)=>sum+lineCampaignDiscount(item),0);
const discounts=()=>billableItems().reduce((sum,item)=>sum+lineManualDiscount(item),0);
const total=()=>subtotal()-campaignDiscounts()-discounts();
const paid=()=>payments.reduce((sum,payment)=>sum+payment.amount,0);

const itemsContainer=document.querySelector('#saleItems');
const itemsEmpty=document.querySelector('#itemsEmpty');
const productDialog=document.querySelector('#productDialog');
const productForm=document.querySelector('#productForm');
const productSearch=document.querySelector('#productSearch');
const productSelect=document.querySelector('#productSelect');
const productSearchResults=document.querySelector('#productSearchResults');
const colorSelect=document.querySelector('#colorSelect');
const sizeSelect=document.querySelector('#sizeSelect');
const clientNameInput=document.querySelector('#clientName');
const clientOptions=document.querySelector('#clientOptions');
const selectedClientHelp=document.querySelector('#selectedClientHelp');
const clientCreateDialog=document.querySelector('#clientCreateDialog');
const clientCreateForm=document.querySelector('#clientCreateForm');
const discountDialog=document.querySelector('#discountDialog');
const discountForm=document.querySelector('#discountForm');
const paymentMethod=document.querySelector('#paymentMethod');
const paymentCurrency=document.querySelector('#paymentCurrency');
const paymentReceived=document.querySelector('#paymentReceived');
const exchangeRate=document.querySelector('#exchangeRate');
const exchangeRateField=document.querySelector('#exchangeRateField');
const paymentCalculation=document.querySelector('#paymentCalculation');
const paymentCalculationNote=document.querySelector('#paymentCalculationNote');
const salesChannel=document.querySelector('#salesChannel');
const toast=document.querySelector('#createToast');
let toastTimer;

function discountCellContent(item){
  if(!item.discount)return '<span class="discount-empty">—</span><span class="discount-edit-icon" aria-hidden="true">✎</span>';
  const type=item.discountType||'amount';
  const value=item.discountValue||item.discount;
  const product=productFor(item);
  const labels={
    percent:`${value.toLocaleString('es-NI',{maximumFractionDigits:2})}%`,
    amount:`− ${money(item.discount)}`,
    final:money(manualDiscountBase(item)-item.discount)
  };
  const details={
    percent:`− ${money(item.discount)} c/u`,
    amount:'por unidad',
    final:'precio final'
  };
  return `<span class="discount-applied"><strong>${labels[type]}</strong><small>${details[type]}</small></span><span class="discount-edit-icon" aria-hidden="true">✎</span>`;
}

function renderItems(){
  const local=salesChannel.value==='local';
  const tableRows=items.map(item=>{
    const product=productFor(item);
    const stock=stockFor(item);
    const hasCampaign=lineCampaignDiscount(item)>0;
    const totalLabel=item.purpose==='selection'
      ? `<span class="selection-price-label">Sin cobrar</span><small>Si la conserva: ${money(lineTotal(item))}</small>`
      : `${money(lineTotal(item))}${hasCampaign||item.discount?`<small>Antes ${money(lineRegularSubtotal(item))}</small>`:''}`;
    const campaign=hasCampaign
      ? `<em class="campaign-tag" title="Descuento automático aplicado por ${product.campaignName}">Campaña · ${product.campaignName}</em>`
      : '';

    return `<tr class="sale-item ${item.purpose==='selection'?'is-selection-item':''}" data-uid="${item.uid}">
      <td class="item-product">
        <div class="item-product-content">
          <img class="item-image" src="${product.image}" alt="${product.name}, color ${item.color}" />
          <div class="item-main">
            <strong>${product.name}</strong>
            <small>SKU: ${product.sku}</small>
            ${campaign}
          </div>
        </div>
      </td>
      <td class="item-meta item-color"><small>Color</small><strong>${item.color}</strong></td>
      <td class="item-meta item-size"><small>Talla</small><strong>${item.size}</strong></td>
      <td class="item-meta item-stock"><small>Stock</small><strong class="stock-value">${stock}</strong></td>
      <td class="item-quantity">
        <span class="sr-only">Cantidad</span>
        <div class="quantity-stepper">
          <button type="button" data-action="decrease" aria-label="Reducir cantidad de ${product.name}">−</button>
          <output aria-label="Cantidad de ${product.name}">${item.quantity}</output>
          <button type="button" data-action="increase" aria-label="Aumentar cantidad de ${product.name}">+</button>
        </div>
      </td>
      <td class="item-purpose">
        <label class="sr-only" for="purpose-${item.uid}">Tipo de ${product.name}</label>
        <select class="purpose-select" id="purpose-${item.uid}" data-action="purpose" data-enhance-select data-viewport-panel ${local?'disabled title="La selección solo está disponible para ventas remotas"':''}>
          <option value="direct" ${item.purpose==='direct'?'selected':''}>Venta directa</option>
          <option value="selection" ${item.purpose==='selection'?'selected':''} ${local?'disabled':''}>Selección</option>
        </select>
      </td>
      <td class="item-discount-cell"><button class="discount-button item-discount ${item.discount?'has-discount':''}" type="button" data-action="discount" aria-haspopup="dialog" aria-label="${item.discount?`Editar descuento de ${product.name}`:`Definir descuento de ${product.name}`}">${discountCellContent(item)}</button></td>
      <td class="item-total"><strong>${totalLabel}</strong></td>
      <td class="item-action"><button class="remove-item" type="button" data-action="remove" aria-label="Quitar ${product.name}">×</button></td>
    </tr>`;
  }).join('');
  itemsContainer.innerHTML=tableRows;
  itemsEmpty.hidden=items.length>0;
  itemsContainer.closest('.sale-items-table-region').hidden=items.length===0;
  document.querySelector('#addAnotherProduct').hidden=items.length===0;
  document.querySelector('#itemCount').textContent=`${items.length} ${items.length===1?'prenda agregada':'prendas agregadas'}`;
  document.querySelector('#summaryItemCount').textContent=items.reduce((sum,item)=>sum+item.quantity,0);
  const selectionCount=items.filter(item=>item.purpose==='selection').reduce((sum,item)=>sum+item.quantity,0);const selectionHelp=document.querySelector('#selectionTotalHelp');selectionHelp.hidden=selectionCount===0;selectionHelp.textContent=selectionCount?`${selectionCount} ${selectionCount===1?'prenda en selección no está incluida':'prendas en selección no están incluidas'} en el total.`:'';
  document.querySelector('#itemsError').textContent='';
  renderSummary();
}

function renderSummary(){
  document.querySelector('#subtotal').textContent=money(subtotal());
  document.querySelector('#campaignDiscountTotal').textContent=`− ${money(campaignDiscounts())}`;
  document.querySelector('#discountTotal').textContent=`− ${money(discounts())}`;
  document.querySelector('#grandTotal').textContent=money(total());
  document.querySelector('#balance').textContent=money(Math.max(0,total()-paid()));
  document.querySelector('#paymentList').innerHTML=payments.map((payment,index)=>`<div class="payment-row"><span>${payment.method} · ${payment.currency==='USD'?'USD':'C$'}<small>${payment.currency==='USD'?`$ ${payment.amountReceivedUsd.toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2})} recibidos · tasa ${payment.exchangeRate.toFixed(4)}`:`${money(payment.amountReceivedNio)} recibidos`}${payment.changeGivenNio?` · cambio ${money(payment.changeGivenNio)}`:''}</small></span><strong>${money(payment.amount)}<small>aplicados</small></strong><button type="button" data-payment-index="${index}" aria-label="Quitar pago de ${money(payment.amount)}">×</button></div>`).join('');
}

itemsContainer.addEventListener('click',event=>{
  const row=event.target.closest('.sale-item');if(!row)return;
  const item=items.find(entry=>entry.uid===Number(row.dataset.uid));
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='increase'&&item.quantity<stockFor(item))item.quantity+=1;
  if(action==='decrease'&&item.quantity>1)item.quantity-=1;
  if(action==='remove'){items=items.filter(entry=>entry.uid!==item.uid);payments=payments.filter(payment=>payment.amount<=total());showToast(`${productFor(item).name} se quitó de la venta.`);}
  if(action==='discount')openDiscount(item,event.target.closest('[data-action="discount"]'));
  if(['increase','decrease','remove'].includes(action))renderItems();
});
itemsContainer.addEventListener('change',event=>{if(event.target.dataset.action!=='purpose')return;const row=event.target.closest('.sale-item');const item=items.find(entry=>entry.uid===Number(row.dataset.uid));item.purpose=salesChannel.value==='local'?'direct':event.target.value;renderItems();});

function findProduct(term){
  const value=term.trim().toLowerCase();if(!value)return null;
  return catalog.find(product=>product.sku.toLowerCase()===value)??null;
}
function matchingProducts(term){
  const value=term.trim().toLowerCase();
  if(!value)return [];
  return catalog.filter(product=>product.sku.toLowerCase().includes(value));
}
function hideProductResults(){
  productSearchResults.hidden=true;
  productSearch.setAttribute('aria-expanded','false');
}
function renderProductResults(){
  const matches=matchingProducts(productSearch.value);
  if(!productSearch.value.trim()){
    hideProductResults();
    productSearchResults.innerHTML='';
    return;
  }
  productSearchResults.innerHTML=matches.length
    ? matches.map(product=>`<button class="product-search-result" type="button" data-product-id="${product.id}">
        <img src="${product.image}" alt="" />
        <span class="product-search-result__info"><strong>${product.sku}</strong><span>${product.name}</span></span>
        <span class="product-search-result__price">${money(product.price)}${product.listPrice?`<small>Antes ${money(product.listPrice)}</small>`:''}</span>
      </button>`).join('')
    : '<p class="product-search-empty">No encontramos una prenda con ese código.</p>';
  productSearchResults.hidden=false;
  productSearch.setAttribute('aria-expanded','true');
}
function clearProductSelection(){
  productSelect.value='';colorSelect.innerHTML='';sizeSelect.innerHTML='';colorSelect.disabled=true;sizeSelect.disabled=true;
}
function selectProduct(product){
  productSelect.value=product.id;productSearch.value=product.sku;colorSelect.disabled=false;sizeSelect.disabled=false;updateProductOptions();hideProductResults();document.querySelector('#productError').textContent='';
}
function updateProductOptions(){
  const product=catalog.find(entry=>entry.id===productSelect.value);if(!product){clearProductSelection();return;}
  colorSelect.innerHTML=product.variants.map(variant=>`<option>${variant.color}</option>`).join('');
  updateSizeOptions();
}
function updateSizeOptions(){
  const product=catalog.find(entry=>entry.id===productSelect.value);if(!product)return;const variant=product.variants.find(entry=>entry.color===colorSelect.value);
  sizeSelect.innerHTML=Object.entries(variant.sizes).map(([size,stock])=>`<option value="${size}" ${stock===0?'disabled':''}>${size} · ${stock} disponibles</option>`).join('');
}
productSearch.addEventListener('input',()=>{
  const product=findProduct(productSearch.value);
  if(product)selectProduct(product);
  else{clearProductSelection();renderProductResults();}
});
productSearch.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){
    const firstResult=productSearchResults.querySelector('.product-search-result');
    if(firstResult){event.preventDefault();firstResult.focus();}
  }
  if(event.key==='Escape')hideProductResults();
});
productSearchResults.addEventListener('click',event=>{
  const result=event.target.closest('[data-product-id]');
  if(!result)return;
  const product=catalog.find(entry=>entry.id===result.dataset.productId);
  if(product)selectProduct(product);
});
productSearchResults.addEventListener('keydown',event=>{
  const result=event.target.closest('.product-search-result');
  if(!result)return;
  if(event.key==='ArrowDown'){
    event.preventDefault();
    (result.nextElementSibling?.matches('.product-search-result')?result.nextElementSibling:productSearchResults.querySelector('.product-search-result'))?.focus();
  }
  if(event.key==='ArrowUp'){
    event.preventDefault();
    (result.previousElementSibling?.matches('.product-search-result')?result.previousElementSibling:productSearch)?.focus();
  }
  if(event.key==='Escape'){hideProductResults();productSearch.focus();}
});
colorSelect.addEventListener('change',updateSizeOptions);

function openProductDialog(){productForm.reset();productSearch.value='';clearProductSelection();hideProductResults();productSearchResults.innerHTML='';document.querySelector('#productError').textContent='';productDialog.showModal();productSearch.focus();}
['#openProductDialog','#addAnotherProduct','#emptyAddProduct'].forEach(selector=>document.querySelector(selector).addEventListener('click',openProductDialog));
productForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='add')return;
  event.preventDefault();
  const data=new FormData(productForm);const product=catalog.find(entry=>entry.id===data.get('product'));
  if(!product){document.querySelector('#productError').textContent='Busca y selecciona una prenda por su código.';productSearch.focus();return;}
  const variant=product.variants.find(entry=>entry.color===data.get('color'));const quantity=1;const available=variant.sizes[data.get('size')];
  const duplicate=items.find(item=>item.productId===product.id&&item.color===data.get('color')&&item.size===data.get('size')&&item.purpose==='direct');
  if(duplicate){if(duplicate.quantity+quantity>available){document.querySelector('#productError').textContent=`Solo hay ${available} unidades disponibles para esta variante.`;return;}duplicate.quantity+=quantity;}else{items.push({uid:nextUid++,productId:product.id,color:data.get('color'),size:data.get('size'),quantity,purpose:'direct',discount:0,discountType:'percent',discountValue:0});}
  productDialog.close();renderItems();showToast(`${product.name} se agregó a la venta.`);
});

function updateDiscountValueHelp(){
  const item=items.find(entry=>entry.uid===activeDiscountUid);if(!item)return;
  const type=discountForm.elements.discountType.value;
  const labels={percent:'Porcentaje por unidad',amount:'Monto por unidad',final:'Precio final por unidad'};
  document.querySelector('#discountValueLabel').textContent=labels[type];
  const valueInput=document.querySelector('.discount-value-input');
  valueInput.classList.toggle('is-prefix',type!=='percent');
  document.querySelector('#discountValueUnit').textContent=type==='percent'?'%':'C$';
  updateDiscountPricePreview();
}
function updateDiscountPricePreview(){
  const item=items.find(entry=>entry.uid===activeDiscountUid);if(!item)return;
  const product=productFor(item);
  const base=manualDiscountBase(item);
  const hasCampaign=product.listPrice>product.price;
  const type=discountForm.elements.discountType.value;
  const value=Number(document.querySelector('#discountValue').value);
  let result=base;
  if(Number.isFinite(value)&&value>=0){
    if(type==='percent')result=base-(base*(value/100));
    if(type==='amount')result=base-value;
    if(type==='final')result=value;
  }
  const valid=Number.isFinite(result)&&result>=0&&result<=base;
  document.querySelector('#discountCurrentPriceLabel').textContent=hasCampaign?'Precio regular':'Precio actual';
  document.querySelector('#discountCurrentPrice').textContent=money(base);
  document.querySelector('#discountCampaignPriceRow').hidden=!hasCampaign;
  document.querySelector('#discountCampaignPrice').textContent=money(product.price);
  document.querySelector('#discountResultPriceLabel').textContent=hasCampaign?'Con descuento manual':'Con descuento';
  document.querySelector('#discountResultPrice').textContent=valid?money(result):'—';
  document.querySelector('.discount-price-preview').classList.toggle('has-invalid-result',!valid);
}
function positionDiscountDialog(trigger){
  const rect=trigger.getBoundingClientRect();
  const width=discountDialog.offsetWidth;
  const height=discountDialog.offsetHeight;
  const left=Math.min(window.innerWidth-width-16,Math.max(16,rect.left));
  const top=Math.min(window.innerHeight-height-16,Math.max(16,rect.top-72));
  discountDialog.style.left=`${left}px`;
  discountDialog.style.top=`${top}px`;
}
function openDiscount(item,trigger){
  activeDiscountUid=item.uid;
  activeDiscountTrigger=trigger;
  discountForm.reset();
  discountForm.elements.discountType.value=item.discountType||'percent';
  document.querySelector('#discountValue').value=item.discountValue||'';
  document.querySelector('#discountError').textContent='';
  updateDiscountValueHelp();
  if(window.innerWidth>780){
    discountDialog.classList.add('is-anchored');
    discountDialog.show();
    positionDiscountDialog(trigger);
  }else{
    discountDialog.classList.remove('is-anchored');
    discountDialog.style.removeProperty('left');
    discountDialog.style.removeProperty('top');
    discountDialog.showModal();
  }
  document.querySelector('#discountValue').focus();
}
discountForm.addEventListener('change',event=>{if(event.target.name==='discountType')updateDiscountValueHelp();});
document.querySelector('#discountValue').addEventListener('input',updateDiscountPricePreview);
discountForm.addEventListener('submit',event=>{
  if(event.submitter?.value!=='apply')return;
  event.preventDefault();const item=items.find(entry=>entry.uid===activeDiscountUid);const data=new FormData(discountForm);const value=Number(data.get('discountValue'));const base=manualDiscountBase(item);let amount=0;
  if(data.get('discountType')==='percent')amount=base*(value/100);if(data.get('discountType')==='amount')amount=value;if(data.get('discountType')==='final')amount=base-value;
  if(!Number.isFinite(amount)||amount<0||amount>base){document.querySelector('#discountError').textContent=`El descuento por unidad debe dejar un precio entre ${money(0)} y ${money(base)}.`;return;}
  item.discount=Math.round(amount*100)/100;item.discountType=data.get('discountType');item.discountValue=value;discountDialog.close();renderItems();showToast(item.discount?'Descuento manual aplicado; la campaña fue reemplazada.':'Descuento manual quitado.');
});
discountDialog.addEventListener('close',()=>{
  discountDialog.classList.remove('is-anchored');
  discountDialog.style.removeProperty('left');
  discountDialog.style.removeProperty('top');
  if(activeDiscountTrigger?.isConnected)activeDiscountTrigger.focus();
});
document.addEventListener('pointerdown',event=>{
  if(!discountDialog.open||!discountDialog.classList.contains('is-anchored'))return;
  if(!discountDialog.contains(event.target)&&!event.target.closest('[data-action="discount"],.pretty-select__panel'))discountDialog.close();
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&discountDialog.open&&discountDialog.classList.contains('is-anchored'))discountDialog.close();
});
window.addEventListener('resize',()=>{
  if(discountDialog.open&&discountDialog.classList.contains('is-anchored')&&activeDiscountTrigger?.isConnected)positionDiscountDialog(activeDiscountTrigger);
});

const roundMoney=value=>Math.round((value+Number.EPSILON)*100)/100;
function calculatePayment(){
  const received=Number(paymentReceived.value);const rate=Number(exchangeRate.value);const remaining=Math.max(0,roundMoney(total()-paid()));
  if(!received||received<=0||(paymentCurrency.value==='USD'&&(!rate||rate<=0)))return null;
  const converted=paymentCurrency.value==='USD'?received*rate:received;
  const amount=roundMoney(Math.min(converted,remaining));
  let change=roundMoney(Math.max(0,converted-amount));
  if(paymentCurrency.value==='USD'&&converted>=remaining&&change<=.5)change=0;
  return {received,rate,converted,remaining,amount,change,exchangeDifferenceNio:paymentCurrency.value==='USD'?roundMoney(converted-change-amount):0};
}
function renderPaymentCalculation(){
  const calculation=calculatePayment();
  paymentCalculation.hidden=!calculation;
  if(!calculation){
    const rate=Number(exchangeRate.value);const remaining=Math.max(0,roundMoney(total()-paid()));const canSuggest=paymentCurrency.value==='USD'&&rate>0&&remaining>0;
    paymentCalculationNote.hidden=!canSuggest;
    if(canSuggest)paymentCalculationNote.textContent=`Monto sugerido para cubrir ${money(remaining)}: $ ${(Math.ceil(remaining/rate*100)/100).toFixed(2)}.`;
    return;
  }
  paymentCalculationNote.hidden=false;
  document.querySelector('#receivedValueNio').textContent=money(roundMoney(calculation.converted));
  document.querySelector('#appliedPreview').textContent=money(calculation.amount);
  document.querySelector('#changePreview').textContent=money(calculation.change);
  const isMixed=payments.length>0&&calculation.amount>=calculation.remaining;
  const hasExchangeDifference=paymentCurrency.value==='USD'&&calculation.change===0&&Math.abs(calculation.exchangeDifferenceNio)>=.01;
  paymentCalculationNote.textContent=isMixed?`Con este movimiento se completa el saldo. El cambio corresponde al total entregado después de los pagos anteriores.`:calculation.change>0?'El cambio se entrega en córdobas y el backend recibe como pago aplicado únicamente el saldo necesario.':hasExchangeDifference?`La diferencia de conversión de ${money(Math.abs(calculation.exchangeDifferenceNio))} se registra sin entregar cambio.`:'Puedes agregar otro movimiento si la clienta combina córdobas y dólares.';
}
function updatePaymentCurrency(){
  const acceptsUsd=['cash','transfer'].includes(paymentMethod.value);
  if(!acceptsUsd)paymentCurrency.value='NIO';
  paymentCurrency.disabled=!acceptsUsd;
  const isUsd=paymentCurrency.value==='USD';const isTransfer=paymentMethod.value==='transfer';
  exchangeRateField.hidden=!isUsd;
  document.querySelector('#receivedAmountLabel').textContent=isTransfer?'Monto transferido':'Monto recibido';
  document.querySelector('#receivedAmountUnit').textContent=isUsd?'$':'C$';
  paymentReceived.value='';document.querySelector('#paymentError').textContent='';renderPaymentCalculation();
}
paymentMethod.addEventListener('change',updatePaymentCurrency);
paymentCurrency.addEventListener('change',updatePaymentCurrency);
paymentReceived.addEventListener('input',renderPaymentCalculation);
exchangeRate.addEventListener('input',renderPaymentCalculation);
updatePaymentCurrency();
document.querySelector('#addPayment').addEventListener('click',()=>{
  const calculation=calculatePayment();const error=document.querySelector('#paymentError');
  if(paid()>=total()){error.textContent='La venta ya está pagada por completo.';return;}
  if(!calculation){error.textContent=paymentCurrency.value==='USD'?'Ingresa un monto recibido y una tasa de cambio válidos.':'Ingresa el monto que entregó la clienta.';paymentReceived.focus();return;}
  const payment={method:paymentMethod.selectedOptions[0].textContent,currency:paymentCurrency.value,amount:calculation.amount,changeGivenNio:calculation.change};
  if(payment.currency==='USD')Object.assign(payment,{amountReceivedUsd:calculation.received,exchangeRate:calculation.rate,exchangeDifferenceNio:calculation.exchangeDifferenceNio});
  else payment.amountReceivedNio=calculation.received;
  payments.push(payment);paymentReceived.value='';error.textContent='';renderSummary();renderPaymentCalculation();showToast(calculation.change>0?`Pago agregado. Entrega ${money(calculation.change)} de cambio.`:'Pago inicial agregado.');
});
document.querySelector('#paymentList').addEventListener('click',event=>{const button=event.target.closest('[data-payment-index]');if(!button)return;payments.splice(Number(button.dataset.paymentIndex),1);renderSummary();showToast('Pago inicial quitado.');});
document.querySelector('#togglePayment').addEventListener('click',event=>{const fields=document.querySelector('#paymentFields');const opening=fields.hidden;const label=opening?'Ocultar información de pago':'Mostrar información de pago';fields.hidden=!opening;event.currentTarget.setAttribute('aria-expanded',String(opening));event.currentTarget.setAttribute('aria-label',label);event.currentTarget.title=label;});
document.querySelectorAll('input[name="operationType"]').forEach(control=>control.addEventListener('change',event=>{document.querySelector('#summaryKind').textContent=event.target.value==='sale'?'Venta':'Reserva';}));
document.querySelector('#saleNotes').addEventListener('input',event=>{document.querySelector('#notesCount').value=event.target.value.length;});
function updateChannelContext(announce=false){
  const local=salesChannel.value==='local';
  const converted=local?items.filter(item=>item.purpose==='selection').length:0;
  if(converted)items.forEach(item=>{if(item.purpose==='selection')item.purpose='direct';});
  if(announce&&converted)showToast(`${converted} ${converted===1?'prenda cambió':'prendas cambiaron'} a venta directa porque la tienda física no admite selección.`);
  return converted;
}
salesChannel.addEventListener('change',()=>{updateChannelContext(true);renderItems();});
updateChannelContext();

function showToast(message){clearTimeout(toastTimer);toast.textContent=message;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,3000);}
const clientSummary=client=>`${client.phone}${client.instagram?` · Instagram ${client.instagram}`:''}${client.messenger?` · Messenger ${client.messenger}`:''}${client.address?` · ${client.address}`:''}`;
function setClientHelp(text){selectedClientHelp.textContent=text;selectedClientHelp.hidden=!text;selectedClientHelp.title=text;}
clientNameInput.addEventListener('input',()=>{selectedClient=clients.find(client=>client.name.toLocaleLowerCase('es')===clientNameInput.value.trim().toLocaleLowerCase('es'))??null;setClientHelp(selectedClient?clientSummary(selectedClient):"");});
document.querySelector('#openClientDialog').addEventListener('click',()=>{clientCreateForm.reset();document.querySelector('#clientCreateError').textContent='';const currentName=clientNameInput.value.trim();if(currentName&&!selectedClient)clientCreateForm.elements.name.value=currentName;clientCreateDialog.showModal();clientCreateForm.elements.name.focus();});
clientCreateForm.addEventListener('submit',event=>{if(event.submitter?.value!=='save')return;event.preventDefault();const name=clientCreateForm.elements.name.value.trim(),phone=clientCreateForm.elements.phone.value.trim(),instagram=clientCreateForm.elements.instagram.value.trim(),messenger=clientCreateForm.elements.messenger.value.trim(),address=clientCreateForm.elements.address.value.trim(),error=document.querySelector('#clientCreateError');const normalizedPhone=phone.replace(/\D/g,'').slice(-8);if(normalizedPhone.length<8){error.textContent='Ingresa un teléfono válido de ocho dígitos.';clientCreateForm.elements.phone.focus();return;}if(clients.some(client=>client.phone.replace(/\D/g,'').slice(-8)===normalizedPhone)){error.textContent='Ya existe un cliente con este teléfono. Búscalo en el selector.';clientCreateForm.elements.phone.focus();return;}const client={id:`C-${101+clients.length}`,name,phone,instagram,messenger,address};clients.push(client);const option=new Option(name,name);option.label=`${name} · ${phone}`;clientOptions.append(option);selectedClient=client;clientNameInput.value=name;setClientHelp(clientSummary(client));clientCreateDialog.close('saved');showToast(`${name} fue creado y seleccionado.`);});
document.querySelector('#saleForm').addEventListener('submit',event=>{
  event.preventDefault();const channel=document.querySelector('#salesChannel');const channelError=document.querySelector('#channelError');let valid=true;
  if(!channel.value){channel.classList.add('is-invalid');channelError.textContent='Selecciona el canal donde se realizó la venta.';valid=false;}else{channel.classList.remove('is-invalid');channelError.textContent='';}
  if(!items.length){document.querySelector('#itemsError').textContent='Agrega al menos una prenda para crear la venta.';valid=false;}
  if(paid()>total()){document.querySelector('#paymentError').textContent='Los pagos no pueden superar el total de la venta.';valid=false;}
  if(!valid){document.querySelector('.is-invalid,#itemsError:not(:empty),#paymentError:not(:empty)')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});return;}
  const button=document.querySelector('#createSale');button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span:last-child').textContent='Creando venta…';
  const clientName=document.querySelector('#clientName').value.trim();const operation=document.querySelector('input[name="operationType"]:checked').value;
  const today=new Date();const dateISO=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');const dateLabel=today.toLocaleDateString('es-NI',{day:'numeric',month:'short',year:'numeric'}).replace('.','');
  const channelLabel=channel.selectedOptions[0].textContent;const client=clientName?(selectedClient?.name===clientName?selectedClient:{name:clientName,phone:'Sin teléfono',instagram:'',messenger:'',address:''}):null;const created={id:'V-0129',date:dateLabel,dateISO,createdAtISO:today.toISOString(),type:operation,typeLabel:operation==='sale'?'Venta':'Reserva',channel:channelLabel,client,comments:document.querySelector('#saleNotes').value.trim(),total:total(),discount:campaignDiscounts()+discounts(),campaignDiscount:campaignDiscounts(),manualDiscount:discounts(),payment:paid()>=total()?'paid':'partial',paid:paid(),delivery:channel.value==='local'?'not-applicable':'none',products:items.map(item=>{const product=productFor(item);return{name:product.name,variant:`${item.color} · Talla ${item.size}`,quantity:item.quantity,unitPrice:unitSalePrice(item),price:lineTotal(item),regularPrice:lineRegularSubtotal(item),campaignName:item.discount?null:product.campaignName,campaignDiscount:lineCampaignDiscount(item),manualUnitDiscount:item.discount,manualDiscount:lineManualDiscount(item),image:product.image,purpose:item.purpose,includedInTotal:item.purpose==='direct',selectionStatus:item.purpose==='selection'?'pending':undefined};})};
  localStorage.setItem('pw-created-sale',JSON.stringify(created));setTimeout(()=>{location.href='sales.html?created=1';},650);
});

const root=document.documentElement;const themeButton=document.querySelector('.theme-button');
function setTheme(theme){root.dataset.theme=theme;const dark=theme==='dark';themeButton.setAttribute('aria-pressed',String(dark));themeButton.setAttribute('aria-label',dark?'Activar modo claro':'Activar modo oscuro');themeButton.querySelector('.theme-label').textContent=dark?'Modo claro':'Modo oscuro';localStorage.setItem('pw-theme',theme);}
setTheme(localStorage.getItem('pw-theme')||'light');themeButton.addEventListener('click',()=>setTheme(root.dataset.theme==='dark'?'light':'dark'));
const menuButton=document.querySelector('.menu-button');const sidebar=document.querySelector('.sidebar');const navBackdrop=document.querySelector('.nav-backdrop');
function closeMenu(){sidebar.classList.remove('is-open');navBackdrop.hidden=true;menuButton.setAttribute('aria-expanded','false');}
menuButton.setAttribute('aria-expanded','false');menuButton.addEventListener('click',()=>{const opening=!sidebar.classList.contains('is-open');sidebar.classList.toggle('is-open',opening);navBackdrop.hidden=!opening;menuButton.setAttribute('aria-expanded',String(opening));if(opening)sidebar.querySelector('a').focus();});navBackdrop.addEventListener('click',closeMenu);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('is-open')){closeMenu();menuButton.focus();}});

renderItems();
