export default function Modal({ titulo, onClose, children, ancho = 540 }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: ancho }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titulo}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
