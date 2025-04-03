import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AnalysisResults } from "@/components/analysis-results";
import { getAnalysisResults } from "@/app/actions";
import { Skeleton } from "@/components/ui/skeleton";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const params = await searchParams;
  const id = params.id;

  if (!id) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Analysis Results
        </h1>
        <Suspense fallback={<ResultsSkeleton />}>
          <ResultsContent id={id} />
        </Suspense>
      </div>
    </div>
  );
}

async function ResultsContent({ id }: { id: string }) {
  const results = await getAnalysisResults(id);

  if (!results) {
    notFound();
  }

  // Ensure the results object has the expected structure
  const safeResults = {
    colors: Array.isArray(results.colors) ? results.colors : [],
    frameworks: Array.isArray(results.frameworks) ? results.frameworks : [],
    images: Array.isArray(results.images) ? results.images : [],
  };

  return <AnalysisResults results={safeResults} />;
}

function ResultsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 gap-4">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
      </div>
    </div>
  );
}
