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
exports.CreateProjectDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var trim = function (v) { return (typeof v === 'string' ? v.trim() : v); };
var CreateProjectDto = function () {
    var _a;
    var _title_decorators;
    var _title_initializers = [];
    var _title_extraInitializers = [];
    var _slug_decorators;
    var _slug_initializers = [];
    var _slug_extraInitializers = [];
    var _summary_decorators;
    var _summary_initializers = [];
    var _summary_extraInitializers = [];
    var _content_decorators;
    var _content_initializers = [];
    var _content_extraInitializers = [];
    var _coverUrl_decorators;
    var _coverUrl_initializers = [];
    var _coverUrl_extraInitializers = [];
    var _category_decorators;
    var _category_initializers = [];
    var _category_extraInitializers = [];
    var _place_decorators;
    var _place_initializers = [];
    var _place_extraInitializers = [];
    var _area_decorators;
    var _area_initializers = [];
    var _area_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _published_decorators;
    var _published_initializers = [];
    var _published_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateProjectDto() {
                this.title = __runInitializers(this, _title_initializers, void 0);
                // opcional: si no viene, se genera desde title + place
                this.slug = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _slug_initializers, void 0));
                this.summary = (__runInitializers(this, _slug_extraInitializers), __runInitializers(this, _summary_initializers, void 0));
                this.content = (__runInitializers(this, _summary_extraInitializers), __runInitializers(this, _content_initializers, void 0));
                this.coverUrl = (__runInitializers(this, _content_extraInitializers), __runInitializers(this, _coverUrl_initializers, void 0));
                // NOT NULL
                this.category = (__runInitializers(this, _coverUrl_extraInitializers), __runInitializers(this, _category_initializers, void 0));
                this.place = (__runInitializers(this, _category_extraInitializers), __runInitializers(this, _place_initializers, void 0));
                this.area = (__runInitializers(this, _place_extraInitializers), __runInitializers(this, _area_initializers, void 0));
                this.status = (__runInitializers(this, _area_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.published = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _published_initializers, void 0));
                __runInitializers(this, _published_extraInitializers);
            }
            return CreateProjectDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _title_decorators = [(0, class_validator_1.IsDefined)({ message: 'title es requerido' }), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                }), (0, class_validator_1.IsNotEmpty)({ message: 'title no puede estar vacío' })];
            _slug_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                })];
            _summary_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                })];
            _content_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _coverUrl_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                })];
            _category_decorators = [(0, class_validator_1.IsDefined)({ message: 'category es requerido' }), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                }), (0, class_validator_1.IsNotEmpty)({ message: 'category no puede estar vacío' })];
            _place_decorators = [(0, class_validator_1.IsDefined)({ message: 'place es requerido' }), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                }), (0, class_validator_1.IsNotEmpty)({ message: 'place no puede estar vacío' })];
            _area_decorators = [(0, class_validator_1.IsDefined)({ message: 'area es requerido' }), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return trim(value);
                }), (0, class_validator_1.IsNotEmpty)({ message: 'area no puede estar vacío' })];
            _status_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _published_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: function (obj) { return "title" in obj; }, get: function (obj) { return obj.title; }, set: function (obj, value) { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
            __esDecorate(null, null, _slug_decorators, { kind: "field", name: "slug", static: false, private: false, access: { has: function (obj) { return "slug" in obj; }, get: function (obj) { return obj.slug; }, set: function (obj, value) { obj.slug = value; } }, metadata: _metadata }, _slug_initializers, _slug_extraInitializers);
            __esDecorate(null, null, _summary_decorators, { kind: "field", name: "summary", static: false, private: false, access: { has: function (obj) { return "summary" in obj; }, get: function (obj) { return obj.summary; }, set: function (obj, value) { obj.summary = value; } }, metadata: _metadata }, _summary_initializers, _summary_extraInitializers);
            __esDecorate(null, null, _content_decorators, { kind: "field", name: "content", static: false, private: false, access: { has: function (obj) { return "content" in obj; }, get: function (obj) { return obj.content; }, set: function (obj, value) { obj.content = value; } }, metadata: _metadata }, _content_initializers, _content_extraInitializers);
            __esDecorate(null, null, _coverUrl_decorators, { kind: "field", name: "coverUrl", static: false, private: false, access: { has: function (obj) { return "coverUrl" in obj; }, get: function (obj) { return obj.coverUrl; }, set: function (obj, value) { obj.coverUrl = value; } }, metadata: _metadata }, _coverUrl_initializers, _coverUrl_extraInitializers);
            __esDecorate(null, null, _category_decorators, { kind: "field", name: "category", static: false, private: false, access: { has: function (obj) { return "category" in obj; }, get: function (obj) { return obj.category; }, set: function (obj, value) { obj.category = value; } }, metadata: _metadata }, _category_initializers, _category_extraInitializers);
            __esDecorate(null, null, _place_decorators, { kind: "field", name: "place", static: false, private: false, access: { has: function (obj) { return "place" in obj; }, get: function (obj) { return obj.place; }, set: function (obj, value) { obj.place = value; } }, metadata: _metadata }, _place_initializers, _place_extraInitializers);
            __esDecorate(null, null, _area_decorators, { kind: "field", name: "area", static: false, private: false, access: { has: function (obj) { return "area" in obj; }, get: function (obj) { return obj.area; }, set: function (obj, value) { obj.area = value; } }, metadata: _metadata }, _area_initializers, _area_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _published_decorators, { kind: "field", name: "published", static: false, private: false, access: { has: function (obj) { return "published" in obj; }, get: function (obj) { return obj.published; }, set: function (obj, value) { obj.published = value; } }, metadata: _metadata }, _published_initializers, _published_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateProjectDto = CreateProjectDto;
