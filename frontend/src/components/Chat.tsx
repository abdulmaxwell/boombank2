import React, { useState } from 'react';

export default function Chat({open, onClose}:{open:boolean, onClose:()=>void}){
  const [msg,setMsg] = useState('');
  const [messages, setMessages] = useState<Array<{from:'user'|'bot', text:string}>>([]);
  async function send(){
    if(!msg) return;
    setMessages(prev=>[...prev, {from:'user', text: msg}]);
    const res = await fetch('/api/support', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: msg, mode: 'real' }) });
    const j = await res.json();
    const reply = j.reply || 'Please wait for the next available agent to connect to you.';
    setMessages(prev=>[...prev, {from:'bot', text: reply}]);
    setMsg('');
  }
  if(!open) return null;
  return (
    <div className='modal open'>
      <div className='modal-content'>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h4>Support Chat</h4><button onClick={onClose}>Close</button></div>
        <div style={{height:240,overflowY:'auto',background:'#021827',padding:8,borderRadius:6,marginTop:8}}>
          {messages.map((m,i)=> <div key={i} style={{textAlign: m.from==='user' ? 'right' : 'left', margin:'6px 0'}}><div style={{display:'inline-block',padding:8,background: m.from==='user' ? '#0f172a' : '#072b3a',borderRadius:8}}>{m.text}</div></div>)}
        </div>
        <div style={{display:'flex',marginTop:8,gap:8}}>
          <input value={msg} onChange={e=>setMsg(e.target.value)} style={{flex:1,padding:8,borderRadius:6}} placeholder='Ask about registration, deposits, withdrawals...' />
          <button onClick={send} className='btn'>Send</button>
        </div>
      </div>
    </div>
  )
}
