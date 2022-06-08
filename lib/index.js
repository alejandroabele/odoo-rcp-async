"use strict";

var Odoo = function (config) {
  config = config || {};

  this.host = config.host;
  this.port = config.port || 80;
  this.database = config.database;
  this.username = config.username;
  this.password = config.password;
  this.secure = config.secure;
};

Odoo.prototype.connect = async function () {
  var params = {
    db: this.database,
    login: this.username,
    password: this.password,
  };

  var json = JSON.stringify({ params: params });
  var url = this.host + "/web/session/authenticate";
  var options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": json.length,
    },
    body: json,
  };

  const res = await fetch(url, options);
  if (res.headers && res.headers.length)
    this.sid = res.headers.map["set-cookie"][0].split(";")[0];
  const data = await res.json();
  if (data.result) {
    this.uid = data.result.uid;
    this.session_id = data.result.session_id;
    this.context = data.result.user_context;
    this.username = data.result.username;
  }
  return data;
};

Odoo.prototype.search = async function (model, params) {
  return await this._request("/web/dataset/call_kw", {
    kwargs: {
      context: this.context,
    },
    model: model,
    method: "search",
    args: [params.domain],
  });
};

// Search & Read records
// https://www.odoo.com/documentation/8.0/api_integration.html#search-and-read
// https://www.odoo.com/documentation/8.0/reference/orm.html#openerp.models.Model.search
// https://www.odoo.com/documentation/8.0/reference/orm.html#openerp.models.Model.read
Odoo.prototype.search_read = async function (model, params) {
  //assert(params.domain, "'domain' parameter required. Must provide a search domain.");
  //assert(params.limit, "'limit' parameter required. Must specify max. number of results to return.");

  const res = await this._request("/web/dataset/call_kw", {
    model: model,
    method: "search_read",
    args: [],
    kwargs: {
      context: this.context,
      domain: params.domain,
      offset: params.offset,
      limit: params.limit,
      order: params.order,
      fields: params.fields,
    },
  });

  return res;
};

// Get record
// https://www.odoo.com/documentation/8.0/api_integration.html#read-records
// https://www.odoo.com/documentation/8.0/reference/orm.html#openerp.models.Model.read
Odoo.prototype.get = async function (model, params) {
  //assert(params.ids, "Must provide a list of IDs.");

  const res = await this._request("/web/dataset/call_kw", {
    model: model,
    method: "read",
    args: [params.ids],
    kwargs: {
      fields: params.fields,
    },
  });
  return res;
}; //get

// Browse records by ID
// Not a direct implementation of Odoo RPC 'browse' but rather a workaround based on 'search_read'
// https://www.odoo.com/documentation/8.0/reference/orm.html#openerp.models.Model.browse
Odoo.prototype.browse_by_id = async function (model, params) {
  params.domain = [["id", ">", "0"]]; // assumes all records IDs are > 0
  const res = await this.search_read(model, params);
  return res;
}; //browse

// Create record
Odoo.prototype.create = async function (model, params) {
  const res = await this._request("/web/dataset/call_kw", {
    kwargs: {
      context: this.context,
    },
    model: model,
    method: "create",
    args: [params],
  });
  return res;
};

// Update record
Odoo.prototype.update = async function (model, id, params) {
  if (id) {
    const res = await this._request("/web/dataset/call_kw", {
      kwargs: {
        context: this.context,
      },
      model: model,
      method: "write",
      args: [[id], params],
    });
    return res;
  }
  return null;
};

// Delete record
Odoo.prototype.delete = async function (model, id, callback) {
  const res = await this._request("/web/dataset/call_kw", {
    kwargs: {
      context: this.context,
    },
    model: model,
    method: "unlink",
    args: [[id]],
  });
  return res;
};

// Generic RPC wrapper
// DOES NOT AUTO-INCLUDE context
Odoo.prototype.rpc_call = async function (endpoint, params) {
  //assert(params.model);
  // assert(params.method);
  // assert(params.args);
  // assert(params.kwargs);
  // assert(params.kwargs.context);

  const res = await this._request(endpoint, params);
  return res;
}; //generic

// Private functions
Odoo.prototype._request = async function (path, params) {
  params = params || {};
  var url = this.host + (path || "/") + "";
  var options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: this.sid + ";",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: new Date().getUTCMilliseconds(),
      method: "call",
      params: params,
    }),
  };

  const res = await fetch(url, options);
  const data = await res.json();
  return data.result;
};

module.exports = Odoo;
