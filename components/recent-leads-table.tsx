"use client"

import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowRightIcon } from "lucide-react"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type Lead = {
  id: string
  name: string
  company: string
  status: string
  tier: string
  score: number
  dossierUrl: string
}

export function RecentLeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Recent Leads</CardTitle>
        <CardDescription>First 10 valid leads</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="w-[80px]">Dossier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(lead.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{lead.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-muted-foreground">
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Tier {lead.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{lead.score}</TableCell>
                  <TableCell>
                    <Link
                      href={lead.dossierUrl || "/dossiers"}
                      className="text-primary text-sm hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dossiers">
            View all leads
            <ArrowRightIcon className="ml-2 size-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
