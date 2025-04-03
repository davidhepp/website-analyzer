import { WebsiteAnalyzerForm } from "@/components/website-analyzer-form"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Website Component Analyzer</h1>
        <p className="text-center text-muted-foreground mb-8">
          Enter a URL to analyze colors, frameworks, and images used on the website.
        </p>
        <WebsiteAnalyzerForm />
      </div>
    </div>
  )
}

