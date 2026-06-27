# 列出模板-ListSandboxTemplates

列出当前项目的模板

# Request Parameters
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Region|string|地域。 参见 [地域和可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|Zone|string|可用区。参见 [可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|ProjectId|string|项目ID。不填写为默认项目，子帐号必须填写。 请参考[GetProjectList接口](https://docs.ucloud.cn/api/summary/get_project_list)|No|
|Offset|int|列表起始位置偏移量，默认为0|No|
|Limit|int|返回数据长度，默认为20，最大100|No|
|Order|string|排序字段。支持：CPU，Memory，CreateTime，UpdateTime|No|
|OrderDesc|bool|是否倒序排序|No|
|Search|string|搜索过滤|No|

# Response Elements
|Parameter name|Type|Description|Required|
|---|---|---|---|
|RetCode|int|返回码|**Yes**|
|Action|string|操作名称|**Yes**|
|Total|int|模板总数|**Yes**|
|Templates|array|模板列表|**Yes**|

## Template
|Parameter name|Type|Description|Required|
|---|---|---|---|
|ID|string|模板ID|**Yes**|
|Alias|string|模板别名|**Yes**|
|CPU|int|CPU|**Yes**|
|MemoryMB|int|内存|**Yes**|
|Type|string|模板类型，preset：预置；custom：自定义|**Yes**|
|CreateTime|int|模板创建时间|**Yes**|
|UpdateTime|int|模板更新时间|**Yes**|

# Request Example
```
https://api.ucloud.cn/?Action=ListSandboxTemplates
&Region=cn-zj
&Zone=cn-zj-01
&ProjectId=zsAsEtwh
&Offset=2
&Limit=5
&Order=EhQrGQPk
&OrderDesc=HIoCrDwC
&Search=MKZwLIxt
```

# Response Example
```
{
    "Templates": [
        "LGuWXnLM"
    ], 
    "Action": "ListSandboxTemplatesResponse", 
    "Total": 3, 
    "RetCode": 0
}
```

