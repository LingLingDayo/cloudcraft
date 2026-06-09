import React from 'react';

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {
  raw: string;
}

export const SvgIcon: React.FC<SvgIconProps> = ({ raw, ...props }) => {
  // 提取 <svg> 内部的内容
  const svgInnerContent = raw.replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, '$1');
  
  // 提取原始 svg 上的 viewBox 属性
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 16 16';

  // 提取原始 svg 上的 fill-rule 属性
  const fillRuleMatch = raw.match(/fill-rule="([^"]+)"/);
  const fillRule = fillRuleMatch ? (fillRuleMatch[1] as React.SVGAttributes<SVGElement>['fillRule']) : undefined;

  return (
    <svg
      viewBox={viewBox}
      fillRule={fillRule}
      dangerouslySetInnerHTML={{ __html: svgInnerContent }}
      {...props}
    />
  );
};
