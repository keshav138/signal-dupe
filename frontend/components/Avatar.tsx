interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

const FALLBACK_COLORS = [
  "#3A76F0",
  "#7C4DFF",
  "#00897B",
  "#F4511E",
  "#8E24AA",
  "#43A047",
  "#D81B60",
  "#039BE5",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export default function Avatar({ name, avatarUrl, size = 48, className = "" }: AvatarProps) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const colorIndex =
    Math.abs([...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) %
    FALLBACK_COLORS.length;

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: FALLBACK_COLORS[colorIndex],
        fontSize: size * 0.38,
      }}
      className={`flex items-center justify-center rounded-full font-medium text-white ${className}`}
    >
      {initials(name)}
    </div>
  );
}
