# 查询模型广场数据-ListUFSquareModel

查询模型广场数据

# Request Parameters
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Region|string|地域。 参见 [地域和可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|No|
|Zone|string|可用区。参见 [可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|No|
|ProjectId|string|项目ID。不填写为默认项目，子帐号必须填写。 请参考[GetProjectList接口](https://docs.ucloud.cn/api/summary/get_project_list)|No|
|ModelType|string|模型类型|No|
|Keyword|string|关键字|No|
|Offset|int|偏移量|No|
|Limit|int|每页数量|No|
|OrderBy|string|排序字段|No|
|Order|string|排序顺序，默认倒序|No|
|MaxModelLen.N|int|上下文长度，数组类型，可选值 [0,4096,16384,32768,131072,256000,262144,1048576]|No|
|Language.N|string|语言，数组类型，可选值 ["chinese", "english"]|No|
|Manufacturer.N|string|制造商，可选值来源于ListUFSquareModelFilters枚举接口。可多选|No|

# Response Elements
|Parameter name|Type|Description|Required|
|---|---|---|---|
|RetCode|int|返回码|**Yes**|
|Action|string|操作名称|**Yes**|
|TotalCount|int|总数|**Yes**|
|SquareModels|array|广场模型|**Yes**|

## SquareModel
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Manufacturer|string|制造商|No|
|Id|string|主键|No|
|Name|string|名称|No|
|SimpleDescribe|string|简要描述|No|
|Describe|string|详细描述|No|
|Language|array|语言|No|
|MaxModelLen|int|模型长度|No|
|ModelType|string|模型类型|No|
|HfUpdateTime|int|HuggingFace 更新时间|No|
|CreateAt|int|创建时间|No|
|UpdateAt|int|更新时间|No|
|SupportedCapabilities|array|模型能力|No|
|Icon|string|图标|No|
|Pricing|object|定价策略|No|
|Tiers|array|价格阶梯（有序数组）|No|

## Pricing
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Completion|float|输出定价|No|
|Prompt|float|提示词定价|No|
|Image|float|生图定价|No|
|Video|string|生视频定价|No|
|Currency|string|币种|No|
|Unit|string|单位（中文），如“次” “百万”|No|
|UnitEn|string|单位（English），如“Time” “Million”|No|

## PriceTier
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Rates|array|该档位下的收费列表（有序数组）|**Yes**|
|DescriptionEn|string|档位描述（例如 "标准上下文 32k"）|**Yes**|
|Condition|string|档位/条件（例如 "32k"、"128k"）|No|
|Description|string|档位描述（例如 "标准上下文 32k"）|No|

## PriceRate
|Parameter name|Type|Description|Required|
|---|---|---|---|
|ChargeItemDescriptionEn|string|收费项描述英文描述|**Yes**|
|Currency|string|货币单位|**Yes**|
|Unit|string|计价单位|**Yes**|
|UnitEn|string|计价单位英文|**Yes**|
|ChargeItem|string|收费项：input/output/thinking/tool...|No|
|ChargeItemDescription|string|收费项描述|No|
|Price|string|价格|No|

# Request Example
```
https://api.ucloud.cn/?Action=ListUFSquareModel
&Region=cn-zj
&Zone=cn-zj-01
&ProjectId=jeBXhvUY
&ModelType=ooGwbevC
&MaxModelLen=RntjYoVL
&Keyword=CwciILMu
&Language=nBzKikde
&Offset=3
&Limit=5
&OrderBy=mtKYCGmg
&Order=EHqJJScF
&Manufacturer.N=TCaomrBe
```

# Response Example
```
{
    "Action": "ListUFSquareModelResponse", 
    "TotalCount": "QlXKGgmL", 
    "SquareModels": [
        "RPQHcFey"
    ], 
    "RetCode": 0
}
```

