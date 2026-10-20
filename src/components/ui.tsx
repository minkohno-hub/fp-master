import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
export function Button({
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button
      {...props}
      className={`button button-${variant} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true" className="empty-symbol">
        ◇
      </span>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <Button variant="quiet" aria-label="閉じる" onClick={onClose}>
          閉じる ×
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function Progress({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div className="progress-group">
      <div>
        <span>{label}</span>
        <strong>{value === null ? "算定できません" : `${value}%`}</strong>
      </div>
      <progress max={100} value={value ?? 0} aria-label={label} />
    </div>
  );
}
