import React from 'react';
import { Info } from 'lucide-react';

export const InfoBanner: React.FC = () => {
  return (
    <div
      id="info-banner"
      className="w-full bg-[#f0f6ff] border border-blue-100/90 rounded-2xl p-5 flex items-start gap-4 mt-6 shadow-2xs"
    >
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          <Info className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>

      <div className="space-y-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <p className="flex items-start gap-2">
          <span className="text-slate-400 select-none">•</span>
          <span>File sẽ được chia thành các đoạn 120 giây để xử lý.</span>
        </p>
        <p className="flex items-start gap-2">
          <span className="text-slate-400 select-none">•</span>
          <span>Kết quả sẽ hiển thị dần trên phần <strong>RESULTS</strong> khi từng đoạn được xử lý.</span>
        </p>
        <p className="flex items-start gap-2">
          <span className="text-slate-400 select-none">•</span>
          <span>Dòng tiến độ hiển thị dạng <strong>"x / y"</strong> (x: số đoạn đã xử lý, y: tổng số đoạn).</span>
        </p>
        <p className="flex items-start gap-2">
          <span className="text-slate-400 select-none">•</span>
          <span>Khi đạt <strong>y / y</strong>, nút <strong>DOWNLOAD</strong> sẽ sáng lên để tải toàn bộ file kết quả về thiết bị.</span>
        </p>
      </div>
    </div>
  );
};
