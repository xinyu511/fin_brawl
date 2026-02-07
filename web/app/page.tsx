export default function Home() {
  return (
    <div className="stack">
      <div className="card">
        <h3 style={{marginTop:0}}>One-day Budget-Tracking LLM Website</h3>
        <p className="muted">
          Login • Upload receipt photo → auto-extracted transaction • Chat to add expenses • Ask affordability questions.
        </p>
        <div className="row">
          <a href="/login"><button>Get started</button></a>
        </div>
      </div>

      <div className="card">
        <h4 style={{marginTop:0}}>Demo questions</h4>
        <ul className="muted" style={{marginBottom:0}}>
          <li>Why am I overspending this month?</li>
          <li>What should I cut first?</li>
          <li>Can I afford a $2000 trip?</li>
          <li>Which city should I live in to have a decent life?</li>
        </ul>
      </div>
    </div>
  );
}
