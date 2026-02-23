interface PostBodyProps {
  body: string;
}

export function PostBody({ body }: PostBodyProps) {
  return (
    <div className="max-w-prose">
      {body.split("\n\n").map((paragraph, i) => (
        <p
          key={i}
          className="font-serif text-base text-zinc-200 leading-[1.85] mb-6 last:mb-0
                     [&:first-child]:text-lg [&:first-child]:text-zinc-100 [&:first-child]:leading-[1.75]"
        >
          {paragraph.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
