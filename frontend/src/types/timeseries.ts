export interface TimeSeriesValue {
  end_time: string;
  value: number;
  group?: string;
}

export interface TimeBinQuery {
  bin: "Second" | "Minute" | "Hour" | "Day";
  value: number;
}

export interface Filter {
  column: string;
  value: string;
}

export interface Aggregate {
  agg_type:
    | "Count"
    | { Sum: string }
    | { Avg: string }
    | { Min: string }
    | { Max: string };
  source: "SpanColumn" | "SpanAttribute";
}

export interface QuerySpec {
  aggregate: Aggregate;
  filters?: Filter[];
  group?: string;
  time_bin?: TimeBinQuery;
}

export interface TimeSeriesQuery {
  querySpec: QuerySpec;
  enabled?: boolean;
}
