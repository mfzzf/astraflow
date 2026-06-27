# 列出沙箱-ListSandboxSandboxes

列出当前项目的沙箱

# Request Parameters
|Parameter name|Type|Description|Required|
|---|---|---|---|
|Region|string|地域。 参见 [地域和可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|Zone|string|可用区。参见 [可用区列表](https://docs.ucloud.cn/api/summary/regionlist)|**Yes**|
|ProjectId|string|项目ID。不填写为默认项目，子帐号必须填写。 请参考[GetProjectList接口](https://docs.ucloud.cn/api/summary/get_project_list)|No|
|Offset|int|列表起始位置偏移量，默认为0|No|
|Limit|int|返回数据长度，默认为20，最大100|No|
|BeginTime|int|起始时间，需使用时间戳|No|
|EndTime|int|结束时间，需使用时间戳，结束时间需大于起始时间|No|
|Order|string|排序字段。支持：CPU，Memory，CreateTime|No|
|OrderDesc|bool|是否倒序排序|No|
|Search|string|搜索过滤|No|
|TemplateID|string|根据模板ID过滤|No|
|CPU|int|根据CPU过滤|No|
|MemoryMB|int|根据内存过滤|No|

# Response Elements
|Parameter name|Type|Description|Required|
|---|---|---|---|
|RetCode|int|返回码|**Yes**|
|Action|string|操作名称|**Yes**|
|Total|int|沙箱总数|**Yes**|
|Sandboxes|array|沙箱列表|**Yes**|

## Sandbox
|Parameter name|Type|Description|Required|
|---|---|---|---|
|ID|string|沙箱ID|**Yes**|
|Alias|string|模板别名|**Yes**|
|TemplateID|string|模板ID|**Yes**|
|CPU|int|CPU核数|**Yes**|
|MemoryMB|int|内存（MB）|**Yes**|
|CreateTime|int|创建时间|**Yes**|
|Status|string|沙箱状态。running：运行中；paused：暂停|**Yes**|

# Request Example
```
https://api.ucloud.cn/?Action=ListSandboxSandboxes
&Region=cn-zj
&Zone=cn-zj-01
&ProjectId=ZUVdRnch
&Offset=4
&Limit=1
&BeginTime=5
&EndTime=4
&Order=dLWShihJ
&OrderDesc=false
&Search=eKjsZgsK
&TemplateID=XUvlaOoj
&CPU=5
&MemoryMB=1
```

# Response Example
```
{
    "Action": "ListSandboxSandboxesResponse", 
    "Total": 4, 
    "Sandboxes": [
        {
            "Status": "QMwxPjsV", 
            "CPU": 2, 
            "MemoryMB": 7, 
            "Alias": "gEZpqdGt", 
            "TemplateID": "EAbIoxRs", 
            "ID": "NKqrGmHv", 
            "CreateTime": 9
        }
    ], 
    "RetCode": 0
}
```

