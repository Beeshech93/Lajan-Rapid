import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBannerConfig } from "@/lib/banner.functions";
import { cn } from "@/lib/utils";

export function AdBanner({ className }: { className?: string }) {
  const getConfig = useServerFn(getBannerConfig);
  const { data } = useQuery({
    queryKey: ["ad_banner_config"],
    queryFn: () => getConfig(),
    staleTime: 60_000,
  });

  if (!data?.enabled) return null;
  if (data.type === "image" && !data.image_url) return null;
  if (data.type === "text" && !data.text) return null;

  const content =
    data.type === "image" ? (
      <img src={data.image_url} alt="" className="block h-auto w-full object-cover" />
    ) : (
      <p className="px-4 py-3 text-center text-sm font-medium text-foreground">{data.text}</p>
    );

  const wrapperClassName = cn(
    "block w-full overflow-hidden rounded-2xl border border-border bg-secondary/40 transition-opacity hover:opacity-90",
    className,
  );

  if (data.link_url) {
    return (
      <a
        href={data.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={wrapperClassName}
      >
        {content}
      </a>
    );
  }

  return <div className={wrapperClassName}>{content}</div>;
}
