// Mark: a crescent moon split by a rising price line. Generated with the
// Magnific image tools, traced to vector, recolored to currentColor so it
// works black on paper and white on dark panels.

type Props = { size?: number; withWordmark?: boolean; className?: string; onDark?: boolean };

export function Logo({ size = 32, className = "", onDark = false, withWordmark = true }: Props) {
  const fontSize = size * 0.72;
  return (
    <span className={`inline-flex items-center gap-[0.35em] ${onDark ? "text-white" : "text-ink"} ${className}`} style={{ fontSize, lineHeight: 1 }}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="inline-flex items-baseline gap-[0.18em] font-bold tracking-tight">
          <span>After</span>
          <span className={`inline-block -skew-x-[8deg] rounded-[0.12em] px-[0.28em] py-[0.08em] ${onDark ? "bg-white text-ink" : "bg-ink text-white"}`}>
            <span className="inline-block skew-x-[8deg]">Hours</span>
          </span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="460 467 1125 1125" aria-hidden="true" className={className} fill="currentColor">
      <path d="M 1479.98 860.115 C 1509.24 857.901 1511.74 881.511 1517.34 904.469 C 1531.99 962.098 1536.49 1021.84 1530.66 1081.01 C 1516.64 1215.82 1450.02 1339.67 1345.25 1425.67 C 1240.42 1511.58 1105.59 1552.03 970.773 1537.99 C 888.787 1529.27 810.186 1500.6 741.845 1454.47 C 730.752 1446.96 715.127 1436.61 706.545 1426.55 C 701.71 1420.89 701.777 1415.27 702.6 1408.29 C 708.013 1394.47 729.337 1367.44 738.653 1354.3 C 761.789 1321.29 785.109 1288.4 808.611 1255.65 L 899.822 1128.06 C 916.739 1104.25 933.348 1080.23 950.724 1056.75 C 956.764 1046.89 974.676 1041.5 984.641 1048.52 C 1002.93 1061.4 1022.09 1081.17 1038.54 1096.47 C 1076.78 1132.62 1115.35 1168.42 1154.23 1203.88 C 1177.62 1225.35 1193.61 1249.96 1219.5 1213.05 C 1233.4 1193.24 1248.28 1172.78 1262.41 1153.03 L 1404.89 955.031 L 1445.3 898.679 C 1454.64 885.624 1465.4 866.378 1479.98 860.115 z" />
      <path d="M 1005.62 508.443 C 1006.65 508.39 1007.67 508.347 1008.69 508.315 C 1024.7 507.876 1067.44 506.577 1077.19 517.762 C 1091.84 537.078 1076.62 549.024 1059.29 554.507 C 896.129 606.136 804.341 791.296 850.312 954.048 C 853.072 964.02 856.289 973.859 859.954 983.535 C 864.857 996.428 880.051 1022.99 877.394 1036.28 C 876.454 1040.98 871.642 1046.95 868.977 1050.87 C 841.202 1091.69 811.539 1131.37 783.04 1171.7 C 768.401 1192.42 664.077 1344.47 653.587 1351.65 C 647.607 1355.74 641.389 1354.92 634.676 1353.5 C 622.032 1346.91 605.761 1320.26 597.664 1307.62 C 549.123 1232.38 521.132 1145.75 516.478 1056.34 C 509.213 916.543 557.581 779.553 651.013 675.309 C 725.002 593.502 823.458 537.81 931.692 516.54 C 956.74 511.782 980.234 509.758 1005.62 508.443 z" />
    </svg>
  );
}
