import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Inbox, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationCenter({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isSubscribed, toggleSubscription, loading: pushLoading } = usePushSubscription();

  useEffect(() => {
    let currentUserId: string | null = null;
    let channel: any = null;

    async function initRealtime() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      currentUserId = data.user.id;

      channel = supabase
        .channel(`in_app_notifications_${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "in_app_notifications",
          },
          (payload: any) => {
            const newRow = payload.new;
            if (!newRow || (newRow.user_id && newRow.user_id !== currentUserId)) return;

            // Immediately invalidate query
            queryClient.invalidateQueries({ queryKey: ["notifications"] });

            // Trigger sonner toast
            toast.info(newRow.title, {
              description: newRow.body,
            });

            // Native browser system notification
            if ("Notification" in window && Notification.permission === "granted") {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready
                  .then((reg) => {
                    reg.showNotification(newRow.title, {
                      body: newRow.body,
                      icon: "/favicon.ico",
                      data: { url: newRow.url || "/" },
                    });
                  })
                  .catch(() => {
                    try {
                      new Notification(newRow.title, {
                        body: newRow.body,
                        icon: "/favicon.ico",
                      });
                    } catch {
                      // ignore
                    }
                  });
              } else {
                try {
                  new Notification(newRow.title, {
                    body: newRow.body,
                    icon: "/favicon.ico",
                  });
                } catch {
                  // ignore
                }
              }
            }
          },
        )
        .subscribe();
    }

    initRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === "42P01") return [];
        console.error("Error fetching notifications:", error);
        return [];
      }
      return data as InAppNotification[];
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("in_app_notifications").update({ is_read: true }).eq("id", id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<InAppNotification[]>(["notifications"]);
      queryClient.setQueryData<InAppNotification[]>(["notifications"], (old) =>
        old?.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      return { previous };
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(["notifications"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await supabase
        .from("in_app_notifications")
        .update({ is_read: true })
        .eq("user_id", userData.user.id)
        .eq("is_read", false);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData<InAppNotification[]>(["notifications"], (old) =>
        old?.map((n) => ({ ...n, is_read: true })),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const NotificationsList = () => (
    <div className="flex flex-col">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`group relative flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/40 transition-colors ${
            !notification.is_read ? "bg-primary/5" : ""
          }`}
        >
          <div className="flex-1 space-y-1">
            <p className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"}`}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground">{notification.body}</p>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted-foreground/70">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </p>
              {notification.url && (
                <Link
                  to={notification.url}
                  className="text-xs text-primary font-medium hover:underline z-10"
                  onClick={() => {
                    if (!notification.is_read) markAsRead.mutate(notification.id);
                    setOpen(false);
                    setDialogOpen(false);
                  }}
                >
                  View details
                </Link>
              )}
            </div>
          </div>
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 absolute top-3 right-3 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead.mutate(notification.id);
              }}
              title="Mark as read"
            >
              <Check className="h-3 w-3 text-primary" />
            </Button>
          )}
          {!notification.is_read && (
            <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary group-hover:hidden" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <DialogTitle>All Notifications</DialogTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => markAllAsRead.mutate()}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-base font-medium">You have no notifications</p>
              </div>
            ) : (
              <NotificationsList />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {children || (
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
              <Bell className="h-[1.1rem] w-[1.1rem]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Toggle notifications</span>
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="right"
          sideOffset={24}
          className="w-80 p-0 rounded-xl shadow-lg border relative z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h4 className="font-semibold text-sm">Notifications</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  setTimeout(() => setDialogOpen(true), 150);
                }}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => markAllAsRead.mutate()}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <div className="px-4 py-2 border-b bg-muted/10 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Push Alerts</span>
            <button
              onClick={toggleSubscription}
              disabled={pushLoading}
              className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/75 ${
                isSubscribed ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className="sr-only">Toggle push notifications</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isSubscribed ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">You have no notifications</p>
              </div>
            ) : (
              <NotificationsList />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
