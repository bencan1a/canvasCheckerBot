# External Tools

{% hint style="warning" %}
**Welcome to Our New API Docs!** This is the new home for all things API (previously at [Canvas LMS REST API Documentation](https://api.instructure.com)).
{% endhint %}

## External Tools API

API for accessing and configuring external tools on accounts and courses. "External tools" are IMS LTI links: http://www.imsglobal.org/developers/LTI/index.cfm

NOTE: Placements not documented here should be considered beta features and are not officially supported.

### [List external tools](#method.external_tools.index) <a href="#method.external_tools.index" id="method.external_tools.index"></a>

[ExternalToolsController#index](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`GET /api/v1/courses/:course_id/external_tools`**

**Scope:** `url:GET|/api/v1/courses/:course_id/external_tools`

**`GET /api/v1/accounts/:account_id/external_tools`**

**Scope:** `url:GET|/api/v1/accounts/:account_id/external_tools`

**`GET /api/v1/groups/:group_id/external_tools`**

**Scope:** `url:GET|/api/v1/groups/:group_id/external_tools`

Returns the paginated list of external tools for the current context. See the get request docs for a single tool for a list of properties on an external tool.

**Request Parameters:**

| Parameter         | Type      | Description                                                                     |
| ----------------- | --------- | ------------------------------------------------------------------------------- |
| `search_term`     | `string`  | The partial name of the tools to match and return.                              |
| `selectable`      | `boolean` | If true, then only tools that are meant to be selectable are returned.          |
| `include_parents` | `boolean` | If true, then include tools installed in all accounts above the current context |
| `placement`       | `string`  | The placement type to filter by.                                                |

**Example Request:**

```bash
Return all tools at the current context as well as all tools from the parent, and filter the tools list to only those with a placement of 'editor_button'
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools?include_parents=true&placement=editor_button' \
     -H "Authorization: Bearer <token>"
```

**Example Response:**

```js
[
 {
   "id": 1,
   "domain": "domain.example.com",
   "url": "http://www.example.com/ims/lti",
   "consumer_key": "key",
   "name": "LTI Tool",
   "description": "This is for cool things",
   "created_at": "2037-07-21T13:29:31Z",
   "updated_at": "2037-07-28T19:38:31Z",
   "privacy_level": "anonymous",
   "custom_fields": {"key": "value"},
   "is_rce_favorite": false,
   "is_top_nav_favorite": false,
   "account_navigation": {
        "canvas_icon_class": "icon-lti",
        "icon_url": "...",
        "text": "...",
        "url": "...",
        "label": "...",
        "selection_width": 50,
        "selection_height":50
   },
   "assignment_selection": null,
   "course_home_sub_navigation": null,
   "course_navigation": {
        "canvas_icon_class": "icon-lti",
        "icon_url": "...",
        "text": "...",
        "url": "...",
        "default": "disabled",
        "enabled": "true",
        "visibility": "public",
        "windowTarget": "_blank"
   },
   "editor_button": {
        "canvas_icon_class": "icon-lti",
        "icon_url": "...",
        "message_type": "ContentItemSelectionRequest",
        "text": "...",
        "url": "...",
        "label": "...",
        "selection_width": 50,
        "selection_height": 50
   },
   "homework_submission": null,
   "link_selection": null,
   "migration_selection": null,
   "resource_selection": null,
   "tool_configuration": null,
   "user_navigation": null,
   "selection_width": 500,
   "selection_height": 500,
   "icon_url": "...",
   "not_selectable": false,
   "deployment_id": null,
   "unified_tool_id": null
 },
 { ...  }
]
```

### [Get a sessionless launch url for an external tool.](#method.external_tools.generate_sessionless_launch) <a href="#method.external_tools.generate_sessionless_launch" id="method.external_tools.generate_sessionless_launch"></a>

[ExternalToolsController#generate\_sessionless\_launch](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`GET /api/v1/courses/:course_id/external_tools/sessionless_launch`**

**Scope:** `url:GET|/api/v1/courses/:course_id/external_tools/sessionless_launch`

**`GET /api/v1/accounts/:account_id/external_tools/sessionless_launch`**

**Scope:** `url:GET|/api/v1/accounts/:account_id/external_tools/sessionless_launch`

Returns a sessionless launch url for an external tool. Prefers the resource\_link\_lookup\_uuid, but defaults to the other passed

```
parameters id, url, and launch_type
```

NOTE: Either the resource\_link\_lookup\_uuid, id, or url must be provided unless launch\_type is assessment or module\_item.

**Request Parameters:**

| Parameter                   | Type     | Description                                                                                                                                                                                                                                                                                |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                        | `string` | The external id of the tool to launch.                                                                                                                                                                                                                                                     |
| `url`                       | `string` | The LTI launch url for the external tool.                                                                                                                                                                                                                                                  |
| `assignment_id`             | `string` | The assignment id for an assignment launch. Required if launch\_type is set to “assessment”.                                                                                                                                                                                               |
| `module_item_id`            | `string` | The assignment id for a module item launch. Required if launch\_type is set to “module\_item”.                                                                                                                                                                                             |
| `launch_type`               | `string` | <p>The type of launch to perform on the external tool. Placement names (eg. “course_navigation”) can also be specified to use the custom launch url for that placement; if done, the tool id must be provided.</p><p>Allowed values: <code>assessment</code>, <code>module_item</code></p> |
| `resource_link_lookup_uuid` | `string` | The identifier to lookup a resource link.                                                                                                                                                                                                                                                  |

**API response field:**

* id

The id for the external tool to be launched.

* name

The name of the external tool to be launched.

* url

The url to load to launch the external tool for the user.

**Example Request:**

```bash
Finds the tool by id and returns a sessionless launch url
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/sessionless_launch' \
     -H "Authorization: Bearer <token>" \
     -F 'id=<external_tool_id>'
```

```bash
Finds the tool by launch url and returns a sessionless launch url
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/sessionless_launch' \
     -H "Authorization: Bearer <token>" \
     -F 'url=<lti launch url>'
```

```bash
Finds the tool associated with a specific assignment and returns a sessionless launch url
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/sessionless_launch' \
     -H "Authorization: Bearer <token>" \
     -F 'launch_type=assessment' \
     -F 'assignment_id=<assignment_id>'
```

```bash
Finds the tool associated with a specific module item and returns a sessionless launch url
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/sessionless_launch' \
     -H "Authorization: Bearer <token>" \
     -F 'launch_type=module_item' \
     -F 'module_item_id=<module_item_id>'
```

```bash
Finds the tool by id and returns a sessionless launch url for a specific placement
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/sessionless_launch' \
     -H "Authorization: Bearer <token>" \
     -F 'id=<external_tool_id>' \
     -F 'launch_type=<placement_name>'
```

### [Get a single external tool](#method.external_tools.show) <a href="#method.external_tools.show" id="method.external_tools.show"></a>

[ExternalToolsController#show](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`GET /api/v1/courses/:course_id/external_tools/:external_tool_id`**

**Scope:** `url:GET|/api/v1/courses/:course_id/external_tools/:external_tool_id`

**`GET /api/v1/accounts/:account_id/external_tools/:external_tool_id`**

**Scope:** `url:GET|/api/v1/accounts/:account_id/external_tools/:external_tool_id`

Returns the specified external tool.

**API response field:**

* id

The unique identifier for the tool

* domain

The domain to match links against

* url

The url to match links against

* consumer\_key

The consumer key used by the tool (The associated shared secret is not returned)

* name

The name of the tool

* description

A description of the tool

* created\_at

Timestamp of creation

* updated\_at

Timestamp of last update

* privacy\_level

How much user information to send to the external tool: “anonymous”, “name\_only”, “email\_only”, “public”

* custom\_fields

Custom fields that will be sent to the tool consumer

* is\_rce\_favorite

Boolean determining whether this tool should be in a preferred location in the RCE.

* is\_top\_nav\_favorite

Boolean determining whether this tool should have a dedicated button in Top Navigation.

* account\_navigation

The configuration for account navigation links (see create API for values)

* assignment\_selection

The configuration for assignment selection links (see create API for values)

* course\_home\_sub\_navigation

The configuration for course home navigation links (see create API for values)

* course\_navigation

The configuration for course navigation links (see create API for values)

* editor\_button

The configuration for a WYSIWYG editor button (see create API for values)

* homework\_submission

The configuration for homework submission selection (see create API for values)

* link\_selection

The configuration for link selection (see create API for values)

* migration\_selection

The configuration for migration selection (see create API for values)

* resource\_selection

The configuration for a resource selector in modules (see create API for values)

* tool\_configuration

The configuration for a tool configuration link (see create API for values)

* user\_navigation

The configuration for user navigation links (see create API for values)

* selection\_width

The pixel width of the iFrame that the tool will be rendered in

* selection\_height

The pixel height of the iFrame that the tool will be rendered in

* icon\_url

The url for the tool icon

* not\_selectable

whether the tool is not selectable from assignment and modules

* unified\_tool\_id

The unique identifier for the tool in LearnPlatform

* deployment\_id

The unique identifier for the deployment of the tool

**Example Response:**

```js
{
  "id": 1,
  "domain": "domain.example.com",
  "url": "http://www.example.com/ims/lti",
  "consumer_key": "key",
  "name": "LTI Tool",
  "description": "This is for cool things",
  "created_at": "2037-07-21T13:29:31Z",
  "updated_at": "2037-07-28T19:38:31Z",
  "privacy_level": "anonymous",
  "custom_fields": {"key": "value"},
  "account_navigation": {
       "canvas_icon_class": "icon-lti",
       "icon_url": "...",
       "text": "...",
       "url": "...",
       "label": "...",
       "selection_width": 50,
       "selection_height":50
  },
  "assignment_selection": null,
  "course_home_sub_navigation": null,
  "course_navigation": {
       "canvas_icon_class": "icon-lti",
       "icon_url": "...",
       "text": "...",
       "url": "...",
       "default": "disabled",
       "enabled": "true",
       "visibility": "public",
       "windowTarget": "_blank"
  },
  "editor_button": {
       "canvas_icon_class": "icon-lti",
       "icon_url": "...",
       "message_type": "ContentItemSelectionRequest",
       "text": "...",
       "url": "...",
       "label": "...",
       "selection_width": 50,
       "selection_height": 50
  },
  "homework_submission": null,
  "link_selection": null,
  "migration_selection": null,
  "resource_selection": null,
  "tool_configuration": null,
  "user_navigation": {
       "canvas_icon_class": "icon-lti",
       "icon_url": "...",
       "text": "...",
       "url": "...",
       "default": "disabled",
       "enabled": "true",
       "visibility": "public"
  },
  "selection_width": 500,
  "selection_height": 500,
  "icon_url": "...",
  "not_selectable": false
}
```

### [Create an external tool](#method.external_tools.create) <a href="#method.external_tools.create" id="method.external_tools.create"></a>

[ExternalToolsController#create](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`POST /api/v1/courses/:course_id/external_tools`**

**Scope:** `url:POST|/api/v1/courses/:course_id/external_tools`

**`POST /api/v1/accounts/:account_id/external_tools`**

**Scope:** `url:POST|/api/v1/accounts/:account_id/external_tools`

Create an external tool in the specified course/account. The created tool will be returned, see the “show” endpoint for an example. If a client ID is supplied canvas will attempt to create a context external tool using the LTI 1.3 standard.

**Request Parameters:**

| Parameter                              | Type              | Description                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client_id`                            | Required `string` | The client id is attached to the developer key. If supplied all other parameters are unnecessary and will be ignored                                                                                                                                                                                                                                                  |
| `name`                                 | Required `string` | The name of the tool                                                                                                                                                                                                                                                                                                                                                  |
| `privacy_level`                        | Required `string` | <p>How much user information to send to the external tool.</p><p>Allowed values: <code>anonymous</code>, <code>name_only</code>, <code>email_only</code>, <code>public</code></p>                                                                                                                                                                                     |
| `consumer_key`                         | Required `string` | The consumer key for the external tool                                                                                                                                                                                                                                                                                                                                |
| `shared_secret`                        | Required `string` | The shared secret with the external tool                                                                                                                                                                                                                                                                                                                              |
| `description`                          | `string`          | A description of the tool                                                                                                                                                                                                                                                                                                                                             |
| `url`                                  | `string`          | The url to match links against. Either “url” or “domain” should be set, not both.                                                                                                                                                                                                                                                                                     |
| `domain`                               | `string`          | The domain to match links against. Either “url” or “domain” should be set, not both.                                                                                                                                                                                                                                                                                  |
| `icon_url`                             | `string`          | The url of the icon to show for this tool                                                                                                                                                                                                                                                                                                                             |
| `text`                                 | `string`          | The default text to show for this tool                                                                                                                                                                                                                                                                                                                                |
| `custom_fields[field_name]`            | `string`          | Custom fields that will be sent to the tool consumer; can be used multiple times                                                                                                                                                                                                                                                                                      |
| `is_rce_favorite`                      | `boolean`         | (Deprecated in favor of [Mark tool to RCE Favorites](#method.external_tools.mark_rce_favorite) and [Unmark tool from RCE Favorites](#method.external_tools.unmark_rce_favorite)) Whether this tool should appear in a preferred location in the RCE. This only applies to tools in root account contexts that have an editor button placement.                        |
| `account_navigation[url]`              | `string`          | The url of the external tool for account navigation                                                                                                                                                                                                                                                                                                                   |
| `account_navigation[enabled]`          | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `account_navigation[text]`             | `string`          | The text that will show on the left-tab in the account navigation                                                                                                                                                                                                                                                                                                     |
| `account_navigation[selection_width]`  | `string`          | The width of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                       |
| `account_navigation[selection_height]` | `string`          | The height of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                      |
| `account_navigation[display_type]`     | `string`          | The layout type to use when launching the tool. Must be “full\_width”, “full\_width\_in\_context”, “full\_width\_with\_nav”, “in\_nav\_context”, “borderless”, or “default”                                                                                                                                                                                           |
| `user_navigation[url]`                 | `string`          | The url of the external tool for user navigation                                                                                                                                                                                                                                                                                                                      |
| `user_navigation[enabled]`             | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `user_navigation[text]`                | `string`          | The text that will show on the left-tab in the user navigation                                                                                                                                                                                                                                                                                                        |
| `user_navigation[visibility]`          | `string`          | Who will see the navigation tab. “admins” for admins, “public” or “members” for everyone. Setting this to ‘null`will remove this configuration and use the default behavior, which is “public”.</p> Allowed values:`admins`,` members`,` public\`                                                                                                                     |
| `course_home_sub_navigation[url]`      | `string`          | The url of the external tool for right-side course home navigation menu                                                                                                                                                                                                                                                                                               |
| `course_home_sub_navigation[enabled]`  | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `course_home_sub_navigation[text]`     | `string`          | The text that will show on the right-side course home navigation menu                                                                                                                                                                                                                                                                                                 |
| `course_home_sub_navigation[icon_url]` | `string`          | The url of the icon to show in the right-side course home navigation menu                                                                                                                                                                                                                                                                                             |
| `course_navigation[enabled]`           | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `course_navigation[text]`              | `string`          | The text that will show on the left-tab in the course navigation                                                                                                                                                                                                                                                                                                      |
| `course_navigation[visibility]`        | `string`          | Who will see the navigation tab. “admins” for course admins, “members” for students, “public” for everyone. Setting this to ‘null`will remove this configuration and use the default behavior, which is “public”.</p> Allowed values:`admins`,` members`,` public\`                                                                                                   |
| `course_navigation[windowTarget]`      | `string`          | <p>Determines how the navigation tab will be opened. “_blank” Launches the external tool in a new window or tab. “_self” (Default) Launches the external tool in an iframe inside of Canvas.</p><p>Allowed values: <code>_blank</code>, <code>_self</code></p>                                                                                                        |
| `course_navigation[default]`           | `string`          | <p>If set to “disabled” the tool will not appear in the course navigation until a teacher explicitly enables it.</p><p><br></p><p>If set to “enabled” the tool will appear in the course navigation without requiring a teacher to explicitly enable it.</p><p><br></p><p>defaults to “enabled”</p><p>Allowed values: <code>disabled</code>, <code>enabled</code></p> |
| `course_navigation[display_type]`      | `string`          | The layout type to use when launching the tool. Must be “full\_width”, “full\_width\_in\_context”, “full\_width\_with\_nav”, “in\_nav\_context”, “borderless”, or “default”                                                                                                                                                                                           |
| `editor_button[url]`                   | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `editor_button[enabled]`               | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `editor_button[icon_url]`              | `string`          | The url of the icon to show in the WYSIWYG editor                                                                                                                                                                                                                                                                                                                     |
| `editor_button[selection_width]`       | `string`          | The width of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                       |
| `editor_button[selection_height]`      | `string`          | The height of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                      |
| `editor_button[message_type]`          | `string`          | Set this to ContentItemSelectionRequest to tell the tool to use content-item; otherwise, omit                                                                                                                                                                                                                                                                         |
| `homework_submission[url]`             | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `homework_submission[enabled]`         | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `homework_submission[text]`            | `string`          | The text that will show on the homework submission tab                                                                                                                                                                                                                                                                                                                |
| `homework_submission[message_type]`    | `string`          | Set this to ContentItemSelectionRequest to tell the tool to use content-item; otherwise, omit                                                                                                                                                                                                                                                                         |
| `link_selection[url]`                  | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `link_selection[enabled]`              | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `link_selection[text]`                 | `string`          | The text that will show for the link selection text                                                                                                                                                                                                                                                                                                                   |
| `link_selection[message_type]`         | `string`          | Set this to ContentItemSelectionRequest to tell the tool to use content-item; otherwise, omit                                                                                                                                                                                                                                                                         |
| `migration_selection[url]`             | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `migration_selection[enabled]`         | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `migration_selection[message_type]`    | `string`          | Set this to ContentItemSelectionRequest to tell the tool to use content-item; otherwise, omit                                                                                                                                                                                                                                                                         |
| `tool_configuration[url]`              | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `tool_configuration[enabled]`          | `boolean`         | Set this to enable this feature                                                                                                                                                                                                                                                                                                                                       |
| `tool_configuration[message_type]`     | `string`          | Set this to ContentItemSelectionRequest to tell the tool to use content-item; otherwise, omit                                                                                                                                                                                                                                                                         |
| `tool_configuration[prefer_sis_email]` | `boolean`         | Set this to default the lis\_person\_contact\_email\_primary to prefer provisioned sis\_email; otherwise, omit                                                                                                                                                                                                                                                        |
| `resource_selection[url]`              | `string`          | The url of the external tool                                                                                                                                                                                                                                                                                                                                          |
| `resource_selection[enabled]`          | `boolean`         | Set this to enable this feature. If set to false, not\_selectable must also be set to true in order to hide this tool from the selection UI in modules and assignments.                                                                                                                                                                                               |
| `resource_selection[icon_url]`         | `string`          | The url of the icon to show in the module external tool list                                                                                                                                                                                                                                                                                                          |
| `resource_selection[selection_width]`  | `string`          | The width of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                       |
| `resource_selection[selection_height]` | `string`          | The height of the dialog the tool is launched in                                                                                                                                                                                                                                                                                                                      |
| `config_type`                          | `string`          | Configuration can be passed in as CC xml instead of using query parameters. If this value is “by\_url” or “by\_xml” then an xml configuration will be expected in either the “config\_xml” or “config\_url” parameter. Note that the name parameter overrides the tool name provided in the xml                                                                       |
| `config_xml`                           | `string`          | XML tool configuration, as specified in the CC xml specification. This is required if “config\_type” is set to “by\_xml”                                                                                                                                                                                                                                              |
| `config_url`                           | `string`          | URL where the server can retrieve an XML tool configuration, as specified in the CC xml specification. This is required if “config\_type” is set to “by\_url”                                                                                                                                                                                                         |
| `not_selectable`                       | `boolean`         | Default: false. If set to true, and if resource\_selection is set to false, the tool won’t show up in the external tool selection UI in modules and assignments                                                                                                                                                                                                       |
| `oauth_compliant`                      | `boolean`         | Default: false, if set to true LTI query params will not be copied to the post body.                                                                                                                                                                                                                                                                                  |
| `unified_tool_id`                      | `string`          | The unique identifier for the tool in LearnPlatform                                                                                                                                                                                                                                                                                                                   |

**Example Request:**

```bash
This would create a tool on this course with two custom fields and a course navigation tab
curl -X POST 'https://<canvas>/api/v1/courses/<course_id>/external_tools' \
     -H "Authorization: Bearer <token>" \
     -F 'name=LTI Example' \
     -F 'consumer_key=asdfg' \
     -F 'shared_secret=lkjh' \
     -F 'url=https://example.com/ims/lti' \
     -F 'privacy_level=name_only' \
     -F 'custom_fields[key1]=value1' \
     -F 'custom_fields[key2]=value2' \
     -F 'course_navigation[text]=Course Materials' \
     -F 'course_navigation[enabled]=true'
```

```bash
This would create a tool on the account with navigation for the user profile page
curl -X POST 'https://<canvas>/api/v1/accounts/<account_id>/external_tools' \
     -H "Authorization: Bearer <token>" \
     -F 'name=LTI Example' \
     -F 'consumer_key=asdfg' \
     -F 'shared_secret=lkjh' \
     -F 'url=https://example.com/ims/lti' \
     -F 'privacy_level=name_only' \
     -F 'user_navigation[url]=https://example.com/ims/lti/user_endpoint' \
     -F 'user_navigation[text]=Something Cool'
     -F 'user_navigation[enabled]=true'
```

```bash
This would create a tool on the account with configuration pulled from an external URL
curl -X POST 'https://<canvas>/api/v1/accounts/<account_id>/external_tools' \
     -H "Authorization: Bearer <token>" \
     -F 'name=LTI Example' \
     -F 'consumer_key=asdfg' \
     -F 'shared_secret=lkjh' \
     -F 'config_type=by_url' \
     -F 'config_url=https://example.com/ims/lti/tool_config.xml'
```

### [Edit an external tool](#method.external_tools.update) <a href="#method.external_tools.update" id="method.external_tools.update"></a>

[ExternalToolsController#update](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`PUT /api/v1/courses/:course_id/external_tools/:external_tool_id`**

**Scope:** `url:PUT|/api/v1/courses/:course_id/external_tools/:external_tool_id`

**`PUT /api/v1/accounts/:account_id/external_tools/:external_tool_id`**

**Scope:** `url:PUT|/api/v1/accounts/:account_id/external_tools/:external_tool_id`

Update the specified external tool. Uses same parameters as create

**Example Request:**

```bash
This would update the specified keys on this external tool
curl -X PUT 'https://<canvas>/api/v1/courses/<course_id>/external_tools/<external_tool_id>' \
     -H "Authorization: Bearer <token>" \
     -F 'name=Public Example' \
     -F 'privacy_level=public'
```

### [Delete an external tool](#method.external_tools.destroy) <a href="#method.external_tools.destroy" id="method.external_tools.destroy"></a>

[ExternalToolsController#destroy](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`DELETE /api/v1/courses/:course_id/external_tools/:external_tool_id`**

**Scope:** `url:DELETE|/api/v1/courses/:course_id/external_tools/:external_tool_id`

**`DELETE /api/v1/accounts/:account_id/external_tools/:external_tool_id`**

**Scope:** `url:DELETE|/api/v1/accounts/:account_id/external_tools/:external_tool_id`

Remove the specified external tool

**Example Request:**

```bash
This would delete the specified external tool
curl -X DELETE 'https://<canvas>/api/v1/courses/<course_id>/external_tools/<external_tool_id>' \
     -H "Authorization: Bearer <token>"
```

### [Mark tool as RCE Favorite](#method.external_tools.mark_rce_favorite) <a href="#method.external_tools.mark_rce_favorite" id="method.external_tools.mark_rce_favorite"></a>

[ExternalToolsController#mark\_rce\_favorite](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`POST /api/v1/accounts/:account_id/external_tools/rce_favorites/:id`**

**Scope:** `url:POST|/api/v1/accounts/:account_id/external_tools/rce_favorites/:id`

Mark the specified editor\_button external tool as a favorite in the RCE editor for courses in the given account and its subaccounts (if the subaccounts haven’t set their own RCE Favorites). This places the tool in a preferred location in the RCE. Cannot mark more than 2 tools as RCE Favorites.

**Example Request:**

```bash
curl -X POST 'https://<canvas>/api/v1/accounts/<account_id>/external_tools/rce_favorites/<id>' \
     -H "Authorization: Bearer <token>"
```

### [Unmark tool as RCE Favorite](#method.external_tools.unmark_rce_favorite) <a href="#method.external_tools.unmark_rce_favorite" id="method.external_tools.unmark_rce_favorite"></a>

[ExternalToolsController#unmark\_rce\_favorite](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`DELETE /api/v1/accounts/:account_id/external_tools/rce_favorites/:id`**

**Scope:** `url:DELETE|/api/v1/accounts/:account_id/external_tools/rce_favorites/:id`

Unmark the specified external tool as a favorite in the RCE editor for the given account. The tool will remain available but will no longer appear in the preferred favorites location.

**Example Request:**

```bash
curl -X DELETE 'https://<canvas>/api/v1/accounts/<account_id>/external_tools/rce_favorites/<id>' \
     -H "Authorization: Bearer <token>"
```

### [Add tool to Top Navigation Favorites](#method.external_tools.add_top_nav_favorite) <a href="#method.external_tools.add_top_nav_favorite" id="method.external_tools.add_top_nav_favorite"></a>

[ExternalToolsController#add\_top\_nav\_favorite](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`POST /api/v1/accounts/:account_id/external_tools/top_nav_favorites/:id`**

**Scope:** `url:POST|/api/v1/accounts/:account_id/external_tools/top_nav_favorites/:id`

Adds a dedicated button in Top Navigation for the specified tool for the given account. Cannot set more than 2 top\_navigation Favorites.

**Example Request:**

```bash
curl -X POST 'https://<canvas>/api/v1/accounts/<account_id>/external_tools/top_nav_favorites/<id>' \
     -H "Authorization: Bearer <token>"
```

### [Remove tool from Top Navigation Favorites](#method.external_tools.remove_top_nav_favorite) <a href="#method.external_tools.remove_top_nav_favorite" id="method.external_tools.remove_top_nav_favorite"></a>

[ExternalToolsController#remove\_top\_nav\_favorite](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`DELETE /api/v1/accounts/:account_id/external_tools/top_nav_favorites/:id`**

**Scope:** `url:DELETE|/api/v1/accounts/:account_id/external_tools/top_nav_favorites/:id`

Removes the dedicated button in Top Navigation for the specified tool for the given account.

**Example Request:**

```bash
curl -X DELETE 'https://<canvas>/api/v1/accounts/<account_id>/external_tools/top_nav_favorites/<id>' \
     -H "Authorization: Bearer <token>"
```

### [Get visible course navigation tools](#method.external_tools.all_visible_nav_tools) <a href="#method.external_tools.all_visible_nav_tools" id="method.external_tools.all_visible_nav_tools"></a>

[ExternalToolsController#all\_visible\_nav\_tools](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`GET /api/v1/external_tools/visible_course_nav_tools`**

**Scope:** `url:GET|/api/v1/external_tools/visible_course_nav_tools`

Get a list of external tools with the course\_navigation placement that have not been hidden in course settings and whose visibility settings apply to the requesting user. These tools are the same that appear in the course navigation.

The response format is the same as for List external tools, but with additional context\_id and context\_name fields on each element in the array.

**Request Parameters:**

| Parameter         | Type              | Description                                                                                                                        |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `context_codes[]` | Required `string` | List of context\_codes to retrieve visible course nav tools for (for example, `course_123`). Only courses are presently supported. |

**API response field:**

* context\_id

The unique identifier of the associated context

* context\_name

The name of the associated context

**Example Request:**

```bash
curl 'https://<canvas>/api/v1/external_tools/visible_course_nav_tools?context_codes[]=course_5' \
     -H "Authorization: Bearer <token>"
```

**Example Response:**

```js
[{
  "id": 1,
  "domain": "domain.example.com",
  "url": "http://www.example.com/ims/lti",
  "context_id": 5,
  "context_name": "Example Course",
  ...
},
{ ...  }]
```

### [Get visible course navigation tools for a single course](#method.external_tools.visible_course_nav_tools) <a href="#method.external_tools.visible_course_nav_tools" id="method.external_tools.visible_course_nav_tools"></a>

[ExternalToolsController#visible\_course\_nav\_tools](https://github.com/instructure/canvas-lms/blob/master/app/controllers/external_tools_controller.rb)

**`GET /api/v1/courses/:course_id/external_tools/visible_course_nav_tools`**

**Scope:** `url:GET|/api/v1/courses/:course_id/external_tools/visible_course_nav_tools`

Get a list of external tools with the course\_navigation placement that have not been hidden in course settings and whose visibility settings apply to the requesting user. These tools are the same that appear in the course navigation.

The response format is the same as Get visible course navigation tools.

**Example Request:**

```bash
curl 'https://<canvas>/api/v1/courses/<course_id>/external_tools/visible_course_nav_tools' \
     -H "Authorization: Bearer <token>"
```

***

This documentation is generated directly from the Canvas LMS source code, available [on Github](https://github.com/instructure/canvas-lms).
