'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Truck, XCircle, RotateCcw, Check, X } from 'lucide-react';

const ORDER_NEXT = {
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};
const ORDER_FILTERS = ['ALL','PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED'];
const RETURN_FILTERS = ['ALL','REQUESTED','APPROVED','REJECTED','RECEIVED','REFUNDED'];

function money(value) {
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value||0));
}
function date(value) {
  if(!value) return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(d);
}

export default function AdminOrdersPage() {
  const [tab,setTab]=useState('orders');
  const [orders,setOrders]=useState([]);
  const [returns,setReturns]=useState([]);
  const [orderFilter,setOrderFilter]=useState('ALL');
  const [returnFilter,setReturnFilter]=useState('ALL');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const [orderResponse,returnResponse]=await Promise.all([
        fetch('/api/admin/orders?status='+encodeURIComponent(orderFilter==='ALL'?'':orderFilter),{cache:'no-store'}),
        fetch('/api/admin/returns?status='+encodeURIComponent(returnFilter==='ALL'?'':returnFilter),{cache:'no-store'}),
      ]);
      const [orderData,returnData]=await Promise.all([orderResponse.json(),returnResponse.json()]);
      if(!orderResponse.ok) throw new Error(orderData.error||'Unable to load orders.');
      if(!returnResponse.ok) throw new Error(returnData.error||'Unable to load returns.');
      setOrders(orderData.orders||[]);
      setReturns(returnData.returns||[]);
      setMessage('');
    } catch(error) { setMessage(error.message||'Unable to load admin data.'); }
    finally { setLoading(false); }
  },[orderFilter,returnFilter]);

  useEffect(()=>{load();},[load]);

  async function updateOrder(orderId,nextStatus) {
    const note=nextStatus==='CANCELLED'?'Cancelled by admin':`Admin moved order to ${nextStatus}`;
    if(nextStatus==='CANCELLED'&&!window.confirm('Cancel this order? A paid Razorpay order will be refunded.')) return;
    setBusy('order-'+orderId); setMessage('');
    try {
      const response=await fetch('/api/admin/orders/'+orderId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({nextStatus,note})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to update order.');
      setMessage(`Order ${orderId} updated to ${nextStatus}.`);
      await load();
    } catch(error) { setMessage(error.message||'Unable to update order.'); }
    finally { setBusy(''); }
  }

  async function updateReturn(returnId,nextStatus) {
    let notes='';
    if(nextStatus==='REJECTED') {
      notes=window.prompt('Explain why this return is being rejected:')||'';
      if(!notes.trim()) return;
    }
    setBusy('return-'+returnId); setMessage('');
    try {
      const response=await fetch('/api/admin/returns/'+returnId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({nextStatus,notes})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||'Unable to update return.');
      setMessage(nextStatus==='REFUNDED'&&payload.refundId?`Refund ${payload.refundId} submitted.`:`Return ${returnId} updated to ${nextStatus}.`);
      await load();
    } catch(error) { setMessage(error.message||'Unable to update return.'); }
    finally { setBusy(''); }
  }

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.2em] text-light-gray">Store operations</p><h1 className="mt-2 text-3xl font-semibold">Orders & returns</h1><p className="mt-2 text-sm text-light-gray">Move paid orders through fulfilment and process customer returns.</p></div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-sm text-white hover:border-white disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/> Refresh</button>
      </header>
      <div className="mb-6 flex gap-2 border-b border-dark-border">
        <button onClick={()=>setTab('orders')} className={'px-4 py-3 text-sm '+(tab==='orders'?'border-b-2 border-white text-white':'text-light-gray')}>Orders ({orders.length})</button>
        <button onClick={()=>setTab('returns')} className={'px-4 py-3 text-sm '+(tab==='returns'?'border-b-2 border-white text-white':'text-light-gray')}>Returns ({returns.length})</button>
      </div>
      {message&&<p role="status" className="mb-5 rounded-lg border border-dark-border bg-dark-secondary p-3 text-sm text-white">{message}</p>}
      {tab==='orders'&&(
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3"><label htmlFor="order-filter" className="text-sm text-light-gray">Filter status</label><select id="order-filter" value={orderFilter} onChange={e=>setOrderFilter(e.target.value)} className="rounded-lg border border-dark-border bg-dark-secondary px-3 py-2 text-sm text-white">{ORDER_FILTERS.map(x=><option key={x} value={x}>{x==='ALL'?'All statuses':x}</option>)}</select></div>
          {loading?<p className="py-12 text-center text-sm text-light-gray">Loading orders…</p>:orders.length===0?<p className="rounded-xl border border-dark-border p-8 text-center text-sm text-light-gray">No orders in this status.</p>:(
            <div className="overflow-x-auto rounded-xl border border-dark-border"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-dark-secondary text-xs uppercase tracking-wide text-light-gray"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody>{orders.map(order=>{
                const next=ORDER_NEXT[order.status];
                return <tr key={order.orderId} className="border-t border-dark-border">
                  <td className="px-4 py-4"><p className="font-medium text-white">{order.orderNumber}</p><p className="mt-1 text-xs text-light-gray">{date(order.createdAt)} · {order.itemCount} item(s)</p></td>
                  <td className="px-4 py-4"><p className="text-white">{order.customerName}</p><p className="text-xs text-light-gray">{order.customerEmail}</p></td>
                  <td className="px-4 py-4 text-white">{order.status}</td><td className="px-4 py-4 text-light-gray">{order.paymentStatus}<p className="text-xs">{order.paymentProvider||'—'}</p></td>
                  <td className="px-4 py-4 text-white">{money(order.totalAmount)}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2">
                    {next&&<button disabled={busy==='order-'+order.orderId} onClick={()=>updateOrder(order.orderId,next)} className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50"><Truck className="h-3 w-3"/>{next}</button>}
                    {['CONFIRMED','PROCESSING'].includes(order.status)&&<button disabled={busy==='order-'+order.orderId} onClick={()=>updateOrder(order.orderId,'CANCELLED')} className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-3 py-2 text-xs text-red-200 disabled:opacity-50"><XCircle className="h-3 w-3"/>Cancel</button>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </>
      )}
      {tab==='returns'&&(
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3"><label htmlFor="return-filter" className="text-sm text-light-gray">Filter status</label><select id="return-filter" value={returnFilter} onChange={e=>setReturnFilter(e.target.value)} className="rounded-lg border border-dark-border bg-dark-secondary px-3 py-2 text-sm text-white">{RETURN_FILTERS.map(x=><option key={x} value={x}>{x==='ALL'?'All statuses':x}</option>)}</select></div>
          {loading?<p className="py-12 text-center text-sm text-light-gray">Loading returns…</p>:returns.length===0?<p className="rounded-xl border border-dark-border p-8 text-center text-sm text-light-gray">No return requests in this status.</p>:(
            <div className="space-y-3">{returns.map(item=><article key={item.returnId} className="rounded-xl border border-dark-border bg-dark-secondary p-5">
              <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-white">{item.productName} · {item.size} · {item.color}</p><p className="mt-1 text-xs text-light-gray">Order {item.orderNumber} · {item.quantity} unit(s)</p><p className="mt-1 text-xs text-light-gray">{item.customerName} · {item.customerEmail}</p></div><div className="text-right"><p className="text-sm text-white">{item.status}</p><p className="mt-1 text-xs text-light-gray">{date(item.requestedAt)}</p></div></div>
              <p className="mt-3 text-sm text-light-gray">{item.reason}</p>
              {item.notes&&<p className="mt-2 text-xs text-light-gray">Note: {item.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.status==='REQUESTED'&&<><button disabled={busy==='return-'+item.returnId} onClick={()=>updateReturn(item.returnId,'APPROVED')} className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-2 text-xs font-medium text-black"><Check className="h-3 w-3"/>Approve</button><button disabled={busy==='return-'+item.returnId} onClick={()=>updateReturn(item.returnId,'REJECTED')} className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-3 py-2 text-xs text-red-200"><X className="h-3 w-3"/>Reject</button></>}
                {item.status==='APPROVED'&&<button disabled={busy==='return-'+item.returnId} onClick={()=>updateReturn(item.returnId,'RECEIVED')} className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black">Mark item received</button>}
                {item.status==='RECEIVED'&&<button disabled={busy==='return-'+item.returnId} onClick={()=>updateReturn(item.returnId,'REFUNDED')} className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black">Issue Razorpay refund</button>}
              </div>
            </article>)}</div>
          )}
        </>
      )}
    </div>
  );
}
