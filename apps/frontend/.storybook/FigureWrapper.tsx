export function FigureWrapper({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="rounded-2xl border border-solid border-gray-200 p-2">
      {title && <figcaption className="mb-2 font-semibold">{title}</figcaption>}
      {children}
    </figure>
  );
}
