import { Fragment } from "react/jsx-runtime";
import { CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateMed, formatDateShort } from "~/lib/formatDate";

/**
 * Shared Recharts axes configuration used by traffic chart components.
 */
export default function ChartAxes() {
  return (
    <Fragment>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" tickFormatter={(v) => formatDateShort(new Date(v))} />
      <YAxis />
      <Tooltip labelFormatter={(value) => formatDateMed(new Date(value))} />
      <Legend />
    </Fragment>
  );
}
