"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, FileText, Download } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Report {
  filename: string;
  path: string;
  created: string;
  size: number;
}

export function SidebarReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchReports();
    }
  }, [isExpanded]);

  const handleDownloadReport = async (filename: string) => {
    try {
      const response = await fetch(`/api/reports/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2 py-2 h-auto"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Reports</span>
              {reports.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {reports.length}
                </span>
              )}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="max-h-64">
              <SidebarMenu>
                {isLoading ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-1 text-sm text-muted-foreground">
                      Loading reports...
                    </div>
                  </SidebarMenuItem>
                ) : reports.length === 0 ? (
                  <SidebarMenuItem>
                    <div className="px-2 py-1 text-sm text-muted-foreground">
                      No reports generated yet
                    </div>
                  </SidebarMenuItem>
                ) : (
                  reports.map((report) => (
                    <SidebarMenuItem key={report.filename}>
                      <div className="flex items-center justify-between w-full px-2 py-1 hover:bg-muted rounded-md group">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {report.filename.replace('.md', '')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(report.created)} • {formatFileSize(report.size)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDownloadReport(report.filename)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </motion.div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
