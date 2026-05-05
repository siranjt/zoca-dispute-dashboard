'use client';

export default function PrintPdfButton() {
  function onClick() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-line bg-elevated/50 text-sm text-ink hover:bg-elevated transition print:hidden"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M8 1.5v9m0 0L4.5 7m3.5 3.5L11.5 7M2 11.5v2A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Download PDF
    </button>
  );
}
