export default function BrandMark({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="SeamCap"
    >
      <rect width="32" height="32" rx="9" fill="#1B9A78" />
      <path
        d="M8.6 19.2c0-4.5 3.4-8.1 7.6-8.1 3.3 0 5.9 1.9 6.8 4.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M8.6 19.2h14.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M12.4 23.1h7.2"
        fill="none"
        stroke="#C5E9DC"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
