import katex from "katex";

/** Server-rendered KaTeX. No client JS; the stylesheet is imported once by the docs page. */
export function M({ children }: { children: string }) {
  return (
    <span
      className="m-inline"
      dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { throwOnError: false, output: "html" }) }}
    />
  );
}

/** A displayed equation with an optional label on the right, like a paper. */
export function MathBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="m-block">
      <div
        className="m-block__eq"
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(children, { throwOnError: false, displayMode: true, output: "html" }),
        }}
      />
      {label && <span className="m-block__label">{label}</span>}
    </div>
  );
}
