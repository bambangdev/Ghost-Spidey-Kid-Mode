import React, { useEffect, useMemo, useRef, useState } from 'react'

type Reward = { id: string; name: string; cost: number }
type Quick = { id: string; em: string; name: string; stars: number }
type ActionLog = { id: string; description: string; stars: number; date: string }
type Redemption = { id: string; rewardName: string; cost: number; date: string }

const KEY = 'gsb_kidmode_react_v1'
const DEFAULT = {
  child: { name: 'Anak', stars: 0 },
  rewards: [
    { id: id(), name: 'Beli Mainan', cost: 10 },
    { id: id(), name: 'Jajan Snack', cost: 5 },
    { id: id(), name: 'Nonton TV', cost: 8 },
    { id: id(), name: 'Main ke Pedro', cost: 12 },
  ] as Reward[],
  quick: [
    { id: id(), em: '📖', name: 'Baca Buku', stars: 1 },
    { id: id(), em: '✏️', name: 'Menulis', stars: 1 },
    { id: id(), em: '📚', name: 'Baca Hafalan', stars: 1 },
    { id: id(), em: '🧹', name: 'Rapikan Mainan', stars: 1 },
    { id: id(), em: '🌙', name: 'Tidur Tepat Waktu', stars: 2 },
    { id: id(), em: '🍚', name: 'Makan Berat', stars: 2 },
  ] as Quick[],
  actions: [] as ActionLog[],
  redemptions: [] as Redemption[],
  sfxOn: true,
  pin: '1234',
}

type State = typeof DEFAULT
function id() { return Math.random().toString(36).slice(2, 9) }
function useLocalState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  return [state, setState] as const
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString() } catch { return iso } }

const rewardIcon: Record<string, string> = {
  'Beli Mainan': 'https://cdn-icons-png.flaticon.com/512/287/287221.png',
  'Jajan Snack': 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
  'Nonton TV': 'https://cdn-icons-png.flaticon.com/512/3107/3107690.png',
  'Main ke Pedro': 'https://cdn-icons-png.flaticon.com/512/1903/1903162.png',
}

const rewardSound: Record<string, string> = {
  'Beli Mainan': 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg',
  'Jajan Snack': 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg',
  'Nonton TV': 'https://actions.google.com/sounds/v1/cartoon/metal_twang.ogg',
  'Main ke Pedro': 'https://actions.google.com/sounds/v1/ambiences/bird_chirps.ogg',
}

export default function App() {
  const [state, setState] = useLocalState<State>(KEY, DEFAULT)
  const [parentOpen, setParentOpen] = useState(false)
  const [pinTry, setPinTry] = useState('')
  const confettiRef = useRef<HTMLCanvasElement>(null)
  const [audCtx, setAudCtx] = useState<AudioContext | null>(null)
  const [currentTab, setCurrentTab] = useState<'stars' | 'quick' | 'rewards'>('stars')

  useEffect(() => { setAudCtx(new (window.AudioContext || (window as any).webkitAudioContext)()) }, [])

  // Confetti loop
  const confettiPieces = useRef<any[]>([])
  useEffect(() => {
    const cvs = confettiRef.current!, ctx = cvs.getContext('2d')!
    const resize = () => { cvs.width = innerWidth; cvs.height = innerHeight }
    resize(); addEventListener('resize', resize)
    let raf = 0
    const tick = () => {
      ctx.clearRect(0,0,cvs.width,cvs.height)
      confettiPieces.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.a += 0.1
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a)
        ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r); ctx.restore()
      })
      confettiPieces.current = confettiPieces.current.filter(p => p.y < cvs.height+20)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  }, [])

  function shootConfetti(){
    const colors = ['#ec4899','#f43f5e','#a78bfa','#fbcfe8','#f472b6']
    for(let i=0;i<120;i++){
      confettiPieces.current.push({
        x: innerWidth * Math.random(), y: -10, r: 4+Math.random()*6,
        c: colors[Math.floor(Math.random()*colors.length)],
        vx: -2+Math.random()*4, vy: 2+Math.random()*4, a: Math.random()*Math.PI
      })
    }
  }

  function tone(freq: number, dur=0.15, type: OscillatorType='sine', vol=0.2){
    try {
      if (!state.sfxOn || !audCtx) return
      const o = audCtx.createOscillator(), g = audCtx.createGain()
      o.type = type; o.frequency.value = freq; g.gain.value = vol
      o.connect(g).connect(audCtx.destination); o.start()
      g.gain.exponentialRampToValueAtTime(0.0001, audCtx.currentTime + dur); o.stop(audCtx.currentTime + dur)
    } catch {}
  }
  function sfxAdd(){ tone(880,0.12,'triangle'); setTimeout(()=>tone(1320,0.10,'sine',0.12), 40) }

  const totalEarned = useMemo(() => state.actions.reduce((s,a)=>s+a.stars,0), [state.actions])
  const totalSpent = useMemo(() => state.redemptions.reduce((s,r)=>s+r.cost,0), [state.redemptions])

  function save(patch: Partial<State>) { setState({ ...state, ...patch }) }
  function addStars(n: number){
    save({ child: { ...state.child, stars: Math.max(0, state.child.stars + n) } })
  }
  function pushAction(desc: string, stars: number){
    save({ actions: [{ id: id(), description: desc, stars, date: new Date().toISOString() }, ...state.actions ] })
  }
  function redeemReward(r: Reward){
    if (state.child.stars < r.cost) return
    save({
      child: { ...state.child, stars: state.child.stars - r.cost },
      redemptions: [{ id: id(), rewardName: r.name, cost: r.cost, date: new Date().toISOString() }, ...state.redemptions]
    })
    if (state.sfxOn && rewardSound[r.name]) new Audio(rewardSound[r.name]).play()
    shootConfetti()
  }

  function computeNext(){
    if (state.rewards.length === 0) return {label:'Belum ada hadiah', need:0, pct:0}
    const sorted = [...state.rewards].sort((a,b)=>a.cost-b.cost)
    let target = sorted.find(r => r.cost > state.child.stars) || sorted[sorted.length-1]
    const need = Math.max(0, target.cost - state.child.stars)
    const prev = [...sorted].reverse().find(r => r.cost <= state.child.stars)
    const base = prev ? prev.cost : 0
    const span = Math.max(1, target.cost - base)
    const pct = Math.min(100, Math.round(((state.child.stars - base) / span) * 100))
    return {label: target.name, need, pct}
  }
  const nx = computeNext()

  // Render helpers
  const StarGrid = () => {
    const cells = Math.max(10, Math.min(30, state.child.stars))
    return <div className="stars-grid">
      {Array.from({length: cells}).map((_,i)=>(
        <div key={i} className={'starcell'+(i<state.child.stars?' active':'')}>{i<state.child.stars?'⭐':''}</div>
      ))}
    </div>
  }

  const QuickGrid = () => (
    <div className="quick">
      {state.quick.map(q => (
        <button key={q.id} onClick={()=>{ addStars(q.stars); pushAction(`${q.em} ${q.name}`, q.stars); sfxAdd() }}>
          <div className="em">{q.em}</div>
          <div className="small" style={{fontWeight:900}}>{q.name}</div>
          <div className="small muted">+{q.stars} ⭐</div>
        </button>
      ))}
    </div>
  )

  const RedeemList = () => (
    <div style={{display:'grid', gridTemplateColumns:'1fr', gap:8}}>
      {state.rewards.map(r => (
        <div key={r.id} className="card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {rewardIcon[r.name] && <img src={rewardIcon[r.name]} style={{width:24,height:24}}/>}
            <div>
              <div style={{fontWeight:900}}>{r.name}</div>
              <div className="small muted">{r.cost} ⭐</div>
            </div>
          </div>
          <button className="pill" disabled={state.child.stars < r.cost} onClick={()=>redeemReward(r)}>Tukar</button>
        </div>
      ))}
    </div>
  )

  // Parent area edit lists
  const [nameInput, setNameInput] = useState(state.child.name)
  const [pinInput, setPinInput] = useState(state.pin)
  const [qaEmoji, setQaEmoji] = useState('⭐')
  const [qaName, setQaName] = useState('Aksi Baru')
  const [qaStars, setQaStars] = useState(1)
  const [rwName, setRwName] = useState('Hadiah Baru')
  const [rwCost, setRwCost] = useState(10)

  useEffect(()=>setNameInput(state.child.name), [state.child.name])
  useEffect(()=>setPinInput(state.pin), [state.pin])

  // Export/Import
  function doExport(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'kidmode-react-backup.json'; a.click()
    URL.revokeObjectURL(url)
  }
  function doImport(file: File){
    const fr = new FileReader()
    fr.onload = ()=>{
      try{
        const data = JSON.parse(String(fr.result))
        if(!data.child||!data.rewards||!data.actions||!data.redemptions) throw new Error('format')
        setState({...DEFAULT, ...data})
        alert('Impor berhasil!')
      }catch{ alert('File tidak valid') }
    }
    fr.readAsText(file)
  }

  return (
    <>
      <canvas id="confetti" ref={confettiRef}></canvas>
      <div className="web-overlay"></div>
      <div className="container">
        <header>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img className="ghost" alt="Ghost-Spidey" src="https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/Spider-Gwen_%28Gwen_Stacy%29.png/220px-Spider-Gwen_%28Gwen_Stacy%29.png" />
            <h1>Ghost-Spidey Star Board</h1>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span className="badge">{state.child.stars} ⭐</span>
            <button className="pill no-print" onClick={()=>save({sfxOn: !state.sfxOn})}>{state.sfxOn?'SFX ON':'SFX OFF'}</button>
            <button className="pill no-print" onClick={()=>setParentOpen(true)}>Mode Orang Tua</button>
          </div>
        </header>

        <nav className="tabs no-print">
          <button className={currentTab==='stars'?'active':''} onClick={()=>setCurrentTab('stars')}>Bintang</button>
          <button className={currentTab==='quick'?'active':''} onClick={()=>setCurrentTab('quick')}>Aksi Cepat</button>
          <button className={currentTab==='rewards'?'active':''} onClick={()=>setCurrentTab('rewards')}>Hadiah</button>
        </nav>

        {currentTab === 'stars' && (
          <>
            <section className="card center">
              <div className="muted">Menuju hadiah berikutnya:</div>
              <div style={{fontSize:20,fontWeight:900,margin:'6px 0'}}>
                {state.rewards.length ? (nx.need>0 ? `${nx.need} lagi untuk ${nx.label}` : `Bisa tukar: ${nx.label}!`) : 'Tambahkan hadiah di Mode Orang Tua'}
              </div>
              <div style={{height:16, background:'#fff', border:'2px solid var(--p200)', borderRadius:999, overflow:'hidden', maxWidth:700, margin:'0 auto'}}>
                <div style={{height:'100%', width:`${nx.pct}%`, background:'linear-gradient(90deg,var(--pink),var(--fuchsia))'}}></div>
              </div>
            </section>

            <section className="row no-print" style={{marginTop:12}}>
              <button className="big-btn" onClick={()=>{ addStars(1); pushAction('⭐ Tambah Bintang',1); sfxAdd() }}>
                <div className="emoji">⭐</div><div>Tambah Bintang</div>
              </button>
            </section>

            <section className="card" style={{marginTop:12}}>
              <StarGrid />
            </section>
          </>
        )}

        {currentTab === 'quick' && (
          <section className="card" style={{marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <b>Aksi Cepat</b>
              <span className="small muted">Orang tua bisa edit di Mode Orang Tua</span>
            </div>
            <QuickGrid />
          </section>
        )}

        {currentTab === 'rewards' && (
          <section className="card" style={{marginTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <b>Hadiah</b>
              <span className="small muted">Atur di Mode Orang Tua</span>
            </div>
            <RedeemList />
          </section>
        )}

        {/* Parent Modal */}
        {parentOpen && (
          <div className="pin-modal" style={{display:'flex'}} onClick={(e)=>{ if(e.target===e.currentTarget) setParentOpen(false) }}>
            <div className="pin-box">
              <div style={{fontWeight:800, marginBottom:6}}>Masuk Mode Orang Tua</div>
              <input className="pin-input" type="password" placeholder="PIN" value={pinTry} onChange={e=>setPinTry(e.target.value)} />
              <div className="toolbar" style={{marginTop:10, justifyContent:'flex-end'}}>
                <button className="pill" onClick={()=>setParentOpen(false)}>Batal</button>
                <button className="pill" onClick={()=>{ if(pinTry === state.pin) setParentOpen(false); else alert('PIN salah') }}>OK</button>
              </div>
              {pinTry === state.pin && (
                <div style={{marginTop:12}}>
                  <div className="row row--2">
                    <div>
                      <h4>Profil</h4>
                      <div className="toolbar">
                        <input className="pill" placeholder="Nama anak" value={nameInput} onChange={e=>setNameInput(e.target.value)} />
                        <button className="pill" onClick={()=>save({ child: { ...state.child, name: nameInput.trim()||'Anak' } })}>Simpan</button>
                      </div>
                      <div className="small muted" style={{marginTop:6}}>Nama sekarang: <b>{state.child.name}</b></div>
                      <div className="toolbar" style={{marginTop:12}}>
                        <input className="pill" style={{width:140}} placeholder="PIN" value={pinInput} onChange={e=>setPinInput(e.target.value)} />
                        <button className="pill" onClick={()=>save({ pin: (pinInput||'1234') })}>Simpan PIN</button>
                      </div>
                    </div>
                    <div>
                      <h4>Backup & Cetak</h4>
                      <div className="toolbar">
                        <button className="pill" onClick={doExport}>Ekspor JSON</button>
                        <label className="pill" htmlFor="fileImport">Impor JSON</label>
                        <input id="fileImport" type="file" accept="application/json" style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f) doImport(f) }} />
                        <button className="pill" onClick={()=>window.print()}>Cetak A4</button>
                      </div>
                    </div>
                  </div>

                  <div className="row row--2" style={{marginTop:12}}>
                    <div>
                      <h4>Aksi Cepat (emoji · nama · bintang)</h4>
                      {state.quick.map(q => (
                        <div className="toolbar" key={q.id}>
                          <input className="pill" style={{width:70}} value={q.em} onChange={e=>save({ quick: state.quick.map(x=>x.id===q.id?{...x, em:e.target.value}:x) })} />
                          <input className="pill" value={q.name} onChange={e=>save({ quick: state.quick.map(x=>x.id===q.id?{...x, name:e.target.value}:x) })} />
                          <input className="pill" style={{width:90}} type="number" value={q.stars} onChange={e=>save({ quick: state.quick.map(x=>x.id===q.id?{...x, stars:Math.max(1,parseInt(e.target.value||'1'))}:x) })} />
                          <button className="pill" onClick={()=>save({ quick: state.quick.filter(x=>x.id!==q.id) })}>Hapus</button>
                        </div>
                      ))}
                      <div className="toolbar" style={{marginTop:6}}>
                        <input className="pill" placeholder="⭐" value={qaEmoji} onChange={e=>setQaEmoji(e.target.value)} />
                        <input className="pill" placeholder="Aksi Baru" value={qaName} onChange={e=>setQaName(e.target.value)} />
                        <input className="pill" style={{width:100}} type="number" value={qaStars} onChange={e=>setQaStars(Math.max(1,parseInt(e.target.value||'1')))} />
                        <button className="pill" onClick={()=>save({ quick: [...state.quick, {id:id(), em:qaEmoji||'⭐', name: qaName.trim()||'Aksi Baru', stars: qaStars}] })}>Tambah Aksi</button>
                      </div>
                    </div>
                    <div>
                      <h4>Hadiah</h4>
                      {state.rewards.map(r => (
                        <div className="toolbar" key={r.id}>
                          <input className="pill" value={r.name} onChange={e=>save({ rewards: state.rewards.map(x=>x.id===r.id?{...x, name:e.target.value}:x) })} />
                          <input className="pill" style={{width:90}} type="number" value={r.cost} onChange={e=>save({ rewards: state.rewards.map(x=>x.id===r.id?{...x, cost:Math.max(1,parseInt(e.target.value||'1'))}:x) })} />
                          <button className="pill" onClick={()=>save({ rewards: state.rewards.filter(x=>x.id!==r.id) })}>Hapus</button>
                        </div>
                      ))}
                      <div className="toolbar" style={{marginTop:6}}>
                        <input className="pill" placeholder="Hadiah Baru" value={rwName} onChange={e=>setRwName(e.target.value)} />
                        <input className="pill" style={{width:100}} type="number" value={rwCost} onChange={e=>setRwCost(Math.max(1,parseInt(e.target.value||'1')))} />
                        <button className="pill" onClick={()=>save({ rewards: [...state.rewards, {id:id(), name: rwName.trim()||'Hadiah Baru', cost: rwCost}] })}>Tambah Hadiah</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="card" style={{marginTop:12}}>
          <div> Total diperoleh: <b>{totalEarned}</b> · Ditukar: <b>{totalSpent}</b> · Sisa: <b>{state.child.stars}</b></div>
          <div className="small muted" style={{marginTop:6}}>Data tersimpan otomatis di perangkat (localStorage). Gunakan ekspor/impor untuk cadangan.</div>
        </section>
      </div>
    </>
  )
}
