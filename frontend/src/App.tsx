import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';

export default function App(){
  const [route,setRoute]=useState('play');
  const [chatOpen,setChatOpen]=useState(false);
  useEffect(()=>{ const h=()=>setRoute(location.hash.replace('#','')||'play'); window.addEventListener('hashchange',h); h(); return ()=>window.removeEventListener('hashchange',h) },[]);
  return (
    <div className='app'>
      <header className='topbar'><div className='brand'>BoomBank</div><div className='bal'>Ksh <span id='bal'>0.00</span></div></header>
      <main className='main'>
        <div style={{display: route==='play' ? 'block' : 'none'}} id='play'><h2>Play</h2><div id='game'>Game UI (see Play page)</div></div>
        <div style={{display: route==='deposit' ? 'block' : 'none'}}><h2>Deposit</h2><p>Deposit page</p></div>
        <div style={{display: route==='withdraw' ? 'block' : 'none'}}><h2>Withdraw</h2><p>Withdraw page</p></div>
        <div style={{display: route==='account' ? 'block' : 'none'}}><h2>Account</h2><p>Account page</p></div>
        <div style={{display: route==='settings' ? 'block' : 'none'}}><h2>Settings</h2><p>Settings page</p></div>
      </main>
      <button className='chat-btn' onClick={()=>setChatOpen(true)}>Chat</button>
      <Chat open={chatOpen} onClose={()=>setChatOpen(false)} />
      <footer className='bottomnav'>
        <button onClick={()=>location.hash='play'}>Play</button>
        <button onClick={()=>location.hash='deposit'}>Deposit</button>
        <button onClick={()=>location.hash='withdraw'}>Withdraw</button>
        <button onClick={()=>location.hash='account'}>Account</button>
      </footer>
    </div>
  )
}
