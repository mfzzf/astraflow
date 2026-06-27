# 批量查询模型价格-GetUFSquareModelPrices

批量查询模型价格

# Request Parameters
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Region|string|地域。 参见 [地域和可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|Zone|string|可用区。参见 [可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|Keyword|string|模型名称模糊搜索（例：deepseek-r1）|No|
|Offset|int|列表起始位置偏移量，默认为0|No|
|Limit|int|返回数据长度，默认为20|No|

# Response Elements
|Parameter name|Type|Description|Required|
|---|---|---|---|
|RetCode|int|返回码|**Yes**|
|Action|string|操作名称|**Yes**|
|Models|array|匹配模型的价格信息|**Yes**|
|TotalCount|int|总条数用于翻页|No|

## ModelPriceGroup
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Manufacturer|string|制造商|**Yes**|
|ModelName|string|模型名称|No|
|ModelId|string|ModelId|No|
|Tiers|array|价格阶梯（有序数组）|No|

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
https://api.ucloud.cn/?Action=GetUFSquareModelPrices
&Region=cn-zj
&Zone=cn-zj-01
&Keyword=tUpakpEx
&Offset=2
&Limit=2
```

# Response Example
```
{
    "Models": [
        {
            "Tiers": [
                {
                    "Rates": [
                        {
                            "ChargeItemDescription": "jydMPQin", 
                            "Price": "xgXpKJwx", 
                            "ChargeItem": "qoFeTVec"
                        }
                    ], 
                    "Description": "sVuQZmlZ", 
                    "Condition": "eNlQgdAu"
                }
            ], 
            "ModelName": "vNbcKKTy", 
            "ModelId": "OimToelj"
        }
    ], 
    "Action": "GetUFSquareModelPricesResponse", 
    "RetCode": 0, 
    "TotalCount": 4
}
```

