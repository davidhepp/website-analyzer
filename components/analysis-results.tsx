"use client"

import { useState } from "react"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, Check, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"

type ColorInfo = {
  value: string
  context: string
}

type AnalysisResultsProps = {
  results: {
    colors: ColorInfo[]
    frameworks: string[]
    images: string[]
  }
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  const [colorFilter, setColorFilter] = useState("")

  // Ensure colors is always an array
  const colors = Array.isArray(results.colors) ? results.colors : []

  // Filter colors based on search input
  const filteredColors = colors.filter(
    (color) =>
      color.value.toLowerCase().includes(colorFilter.toLowerCase()) ||
      color.context.toLowerCase().includes(colorFilter.toLowerCase()),
  )

  return (
    <Tabs defaultValue="colors" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="colors">
          Colors <Badge className="ml-2">{colors.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="frameworks">
          Frameworks <Badge className="ml-2">{results.frameworks.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="images">
          Images <Badge className="ml-2">{results.images.length}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="colors" className="mt-6">
        <div className="mb-4 flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Colors Used</h2>
          <p className="text-sm text-muted-foreground">
            These colors are visible on the website with their usage context.
          </p>
          <Input
            placeholder="Filter colors or contexts..."
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="max-w-md"
          />
        </div>
        {filteredColors.length === 0 ? (
          <p className="text-muted-foreground">
            {colors.length === 0 ? "No colors detected." : "No colors match your filter."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredColors.map((color, index) => (
              <ColorCard key={index} color={color} />
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="frameworks" className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Detected Frameworks</h2>
        {results.frameworks.length === 0 ? (
          <p className="text-muted-foreground">No frameworks detected.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.frameworks.map((framework, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="font-medium">{framework}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="images" className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Images Found</h2>
        {results.images.length === 0 ? (
          <p className="text-muted-foreground">No images detected.</p>
        ) : (
          <div className="space-y-4">
            {results.images.map((imageUrl, index) => (
              <ImageCard key={index} imageUrl={imageUrl} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

function ColorCard({ color }: { color: ColorInfo }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(color.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format the context to highlight quoted text
  const formatContext = (context: string) => {
    // Split by commas, but preserve quoted text
    const parts = context.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((part) => part.trim())

    return (
      <div className="text-xs text-muted-foreground mt-1 space-y-1">
        {parts.map((part, i) => {
          // Check if this part contains quoted text
          const quoteMatch = part.match(/"([^"]+)"/)
          if (quoteMatch) {
            const [before, quoted, after] = part.split(/"([^"]+)"/)
            return (
              <div key={i}>
                {before && <span>{before}</span>}
                {quoted && <span className="font-medium text-foreground">"{quoted}"</span>}
                {after && <span>{after}</span>}
              </div>
            )
          }
          return <div key={i}>{part}</div>
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-md border" style={{ backgroundColor: color.value }}></div>
        <div className="flex-1">
          <div className="font-mono text-sm">{color.value}</div>
          {formatContext(color.context)}
        </div>
        <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-8 w-8">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardContent>
    </Card>
  )
}

function ImageCard({ imageUrl }: { imageUrl: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="relative w-full sm:w-32 h-24 bg-muted rounded-md overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Image Preview
            </div>
            <Image
              src={imageUrl || "/placeholder.svg"}
              alt="Website image"
              fill
              className="object-contain"
              onError={(e) => {
                // Hide the image on error
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
          <div className="flex-1 break-all">
            <div className="font-mono text-xs mb-2">{imageUrl}</div>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                Open Image <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

