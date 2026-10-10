import { Editor } from "@/components/Editor";

export default async function ShotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;
  const n = Number(v);
  return <Editor key={id} id={id} requestedV={Number.isInteger(n) && n > 0 ? n : null} />;
}
