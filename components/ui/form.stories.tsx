import type { Meta, StoryObj } from "@storybook/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "./button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input } from "./input";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Min 8 characters"),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => alert(JSON.stringify(values)))}
        className="w-[320px] space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormDescription>Your FlightOps account email.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </Form>
  );
}

const meta: Meta<typeof LoginForm> = {
  title: "UI/Form",
  component: LoginForm,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Login: Story = {};
