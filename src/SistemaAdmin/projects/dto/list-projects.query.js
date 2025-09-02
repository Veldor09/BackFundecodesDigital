"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListProjectsQuery = exports.STATUS_VALUES = void 0;
var class_transformer_1 = require("class-transformer");
var class_validator_1 = require("class-validator");
exports.STATUS_VALUES = ['EN_PROCESO', 'FINALIZADO', 'PAUSADO'];
var ListProjectsQuery = function () {
    var _a;
    var _q_decorators;
    var _q_initializers = [];
    var _q_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _place_decorators;
    var _place_initializers = [];
    var _place_extraInitializers = [];
    var _area_decorators;
    var _area_initializers = [];
    var _area_extraInitializers = [];
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _pageSize_decorators;
    var _pageSize_initializers = [];
    var _pageSize_extraInitializers = [];
    var _published_decorators;
    var _published_initializers = [];
    var _published_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ListProjectsQuery() {
                this.q = __runInitializers(this, _q_initializers, void 0);
                this.category = (__runInitializers(this, _q_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.status = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.place = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _place_initializers, void 0));
                this.area = (__runInitializers(this, _place_extraInitializers), __runInitializers(this, _area_initializers, void 0));
                this.page = (__runInitializers(this, _area_extraInitializers), __runInitializers(this, _page_initializers, 1));
                this.pageSize = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _pageSize_initializers, 10));
                this.published = (__runInitializers(this, _pageSize_extraInitializers), __runInitializers(this, _published_initializers, void 0));
                __runInitializers(this, _published_extraInitializers);
            }
            return ListProjectsQuery;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _q_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _category_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsIn)(exports.STATUS_VALUES, {
                    message: "status debe ser uno de: ".concat(exports.STATUS_VALUES.join(', ')),
                })];
            _place_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _area_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _page_decorators = [(0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseInt(value, 10);
                }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _pageSize_decorators = [(0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseInt(value, 10);
                }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _published_decorators = [(0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === 'true';
                })];
            __esDecorate(null, null, _q_decorators, { kind: "field", name: "q", static: false, private: false, access: { has: function (obj) { return "q" in obj; }, get: function (obj) { return obj.q; }, set: function (obj, value) { obj.q = value; } }, metadata: _metadata }, _q_initializers, _q_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _place_decorators, { kind: "field", name: "place", static: false, private: false, access: { has: function (obj) { return "place" in obj; }, get: function (obj) { return obj.place; }, set: function (obj, value) { obj.place = value; } }, metadata: _metadata }, _place_initializers, _place_extraInitializers);
            __esDecorate(null, null, _area_decorators, { kind: "field", name: "area", static: false, private: false, access: { has: function (obj) { return "area" in obj; }, get: function (obj) { return obj.area; }, set: function (obj, value) { obj.area = value; } }, metadata: _metadata }, _area_initializers, _area_extraInitializers);
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _pageSize_decorators, { kind: "field", name: "pageSize", static: false, private: false, access: { has: function (obj) { return "pageSize" in obj; }, get: function (obj) { return obj.pageSize; }, set: function (obj, value) { obj.pageSize = value; } }, metadata: _metadata }, _pageSize_initializers, _pageSize_extraInitializers);
            __esDecorate(null, null, _published_decorators, { kind: "field", name: "published", static: false, private: false, access: { has: function (obj) { return "published" in obj; }, get: function (obj) { return obj.published; }, set: function (obj, value) { obj.published = value; } }, metadata: _metadata }, _published_initializers, _published_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ListProjectsQuery = ListProjectsQuery;
