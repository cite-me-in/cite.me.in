import { Tabs as BaseUITabs } from "@base-ui/react/tabs";
import * as React from "react";
import { twMerge } from "tailwind-merge";

const Tabs = BaseUITabs.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof BaseUITabs.List>,
  React.ComponentPropsWithoutRef<typeof BaseUITabs.List>
>(({ className, ...props }, ref) => (
  <BaseUITabs.List
    ref={ref}
    className={twMerge(
      "inline-flex items-center justify-center gap-2 rounded-base border-2 border-black bg-[hsl(60,100%,99%)] p-2 shadow-[2px_2px_0px_0px_black]",
      className?.toString(),
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseUITabs.Tab>,
  React.ComponentPropsWithoutRef<typeof BaseUITabs.Tab>
>(({ className, ...props }, ref) => (
  <BaseUITabs.Tab
    ref={ref}
    className={twMerge(
      "inline-flex items-center justify-center whitespace-nowrap rounded-base border-2 border-transparent px-4 py-2 font-bold text-base text-black transition-all duration-100 hover:border-black hover:bg-white data-active:border-black data-active:bg-[#F59E0B] data-active:shadow-[2px_2px_0px_0px_black]",
      className?.toString(),
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof BaseUITabs.Panel>,
  React.ComponentPropsWithoutRef<typeof BaseUITabs.Panel>
>(({ className, ...props }, ref) => (
  <BaseUITabs.Panel
    ref={ref}
    className={twMerge(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className?.toString(),
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
