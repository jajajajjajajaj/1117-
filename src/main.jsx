import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// 오류가 나면 빈 화면 대신 원인을 보여줍니다. / Show the error instead of a blank page.
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div className="wrap">
          <div className="card" style={{ borderColor: "#E9C7C8" }}>
            <strong>오류가 발생했습니다 / Something went wrong</strong>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{String(this.state.err?.stack || this.state.err)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) root.innerHTML = `<div class="wrap"><div class="card"><strong>오류 / Error</strong><pre style="white-space:pre-wrap;font-size:12px">${e.message}</pre></div></div>`;
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
