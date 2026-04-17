"""
Lottie JSON 动画文件验证脚本

功能：验证 Lottie JSON 文件的结构完整性和数据合法性
用法：python3 validate_lottie.py <json文件路径>
退出码：0=验证通过，1=验证失败

函数列表：
- validate_top_level: 验证顶层必填字段
- validate_frame_range: 验证帧范围逻辑
- validate_keyframe: 验证单个关键帧属性结构
- validate_transform: 验证图层变换属性
- validate_color: 验证颜色值范围
- validate_shapes: 验证形状图层的 shapes 数组
- validate_layer: 验证单个图层结构
- validate_lottie: 主验证入口
- main: CLI 入口
"""

import json
import sys
from pathlib import Path
from typing import Any


# 验证错误收集列表
errors: list[str] = []


def add_error(msg: str) -> None:
    """添加一条验证错误信息"""
    errors.append(f"❌ {msg}")


def add_warning(msg: str) -> None:
    """添加一条验证警告信息"""
    errors.append(f"⚠️ {msg}")


def validate_top_level(data: dict[str, Any]) -> None:
    """验证顶层必填字段是否存在且类型正确"""
    # 必填字段及其期望类型
    required_fields: dict[str, tuple[type, ...]] = {
        "v": (str,),           # 版本号
        "fr": (int, float),    # 帧率
        "ip": (int, float),    # 起始帧
        "op": (int, float),    # 结束帧
        "w": (int, float),     # 画布宽度
        "h": (int, float),     # 画布高度
        "layers": (list,),     # 图层数组
    }

    for field, expected_types in required_fields.items():
        # 检查字段是否存在
        if field not in data:
            add_error(f"缺少顶层必填字段: {field}")
            continue
        # 检查字段类型
        if not isinstance(data[field], expected_types):
            type_names = "/".join(t.__name__ for t in expected_types)
            add_error(
                f"顶层字段 '{field}' 类型错误: "
                f"期望 {type_names}，实际 {type(data[field]).__name__}"
            )


def validate_frame_range(data: dict[str, Any]) -> None:
    """验证帧范围逻辑：ip 必须小于 op"""
    ip = data.get("ip")
    op = data.get("op")
    # 只有两个值都存在且为数字时才检查
    if isinstance(ip, (int, float)) and isinstance(op, (int, float)):
        if ip >= op:
            add_error(f"帧范围错误: ip({ip}) 必须小于 op({op})")
        if op <= 0:
            add_error(f"结束帧 op({op}) 必须大于 0")
    # 帧率检查
    fr = data.get("fr")
    if isinstance(fr, (int, float)) and fr <= 0:
        add_error(f"帧率 fr({fr}) 必须大于 0")


def validate_color(color: Any, path: str) -> None:
    """验证颜色值是否在 0-1 归一化范围内"""
    if not isinstance(color, list):
        return
    # 颜色数组长度应为 3（RGB）或 4（RGBA）
    if len(color) < 3:
        return
    for i, val in enumerate(color[:4]):
        if isinstance(val, (int, float)):
            if val < 0 or val > 1:
                add_error(
                    f"颜色值超出范围 [{path}]: "
                    f"索引{i} 值为 {val}，应在 0-1 之间"
                )


def validate_keyframe(prop: dict[str, Any], path: str) -> None:
    """
    验证单个可动画属性的关键帧结构
    当 a=1（动画模式）时，k 必须是包含 t 字段的对象数组
    """
    if not isinstance(prop, dict):
        return

    animated = prop.get("a", 0)
    k = prop.get("k")

    if animated == 1:
        # 动画模式：k 必须是对象数组
        if not isinstance(k, list):
            add_error(f"关键帧错误 [{path}]: a=1 时 k 必须是数组")
            return
        if len(k) == 0:
            add_error(f"关键帧错误 [{path}]: a=1 时 k 数组不能为空")
            return
        # 检查数组内容是否为关键帧对象
        for i, kf in enumerate(k):
            if isinstance(kf, dict):
                # 每个关键帧对象必须有 t（时间）字段
                if "t" not in kf:
                    add_error(
                        f"关键帧错误 [{path}]: "
                        f"第 {i} 个关键帧缺少 t（时间）字段"
                    )
                # 检查 s（起始值）是否存在
                if "s" not in kf:
                    add_warning(
                        f"关键帧警告 [{path}]: "
                        f"第 {i} 个关键帧缺少 s（起始值）字段"
                    )
            # 如果 k 内是纯数字数组，说明可能是静态值误标了 a=1
            elif isinstance(kf, (int, float)):
                add_error(
                    f"关键帧错误 [{path}]: "
                    f"a=1 时 k 应该是对象数组，但发现纯数字"
                )
                break


def validate_transform(ks: dict[str, Any], layer_path: str) -> None:
    """验证图层变换属性（ks）的结构"""
    if not isinstance(ks, dict):
        add_error(f"变换属性错误 [{layer_path}]: ks 必须是对象")
        return

    # 变换属性列表
    transform_props = ["a", "p", "s", "r", "o"]
    for prop_name in transform_props:
        if prop_name in ks:
            prop = ks[prop_name]
            validate_keyframe(prop, f"{layer_path}.ks.{prop_name}")


def validate_shapes(shapes: list[Any], layer_path: str) -> None:
    """递归验证形状数组中的每个形状元素"""
    for i, shape in enumerate(shapes):
        if not isinstance(shape, dict):
            add_error(f"形状错误 [{layer_path}]: 第 {i} 个元素不是对象")
            continue

        shape_type = shape.get("ty")
        shape_path = f"{layer_path}.shapes[{i}]({shape_type})"

        # 填充/描边的颜色检查
        if shape_type in ("fl", "st", "gf", "gs"):
            color_prop = shape.get("c")
            if isinstance(color_prop, dict):
                color_val = color_prop.get("k")
                if color_val is not None:
                    # 静态颜色值
                    if isinstance(color_val, list) and len(color_val) > 0:
                        # 判断是否是关键帧数组（第一个元素是 dict）
                        if isinstance(color_val[0], (int, float)):
                            validate_color(color_val, shape_path)
                # 验证关键帧结构
                validate_keyframe(color_prop, f"{shape_path}.c")

        # 分组递归
        if shape_type == "gr":
            sub_items = shape.get("it", [])
            if isinstance(sub_items, list):
                validate_shapes(sub_items, shape_path)


def validate_layer(layer: dict[str, Any], index: int) -> None:
    """验证单个图层的结构完整性"""
    layer_name = layer.get("nm", f"unnamed_{index}")
    layer_path = f"layers[{index}]({layer_name})"

    # 图层类型必须存在
    ty = layer.get("ty")
    if ty is None:
        add_error(f"图层错误 [{layer_path}]: 缺少 ty（图层类型）字段")
        return

    # 有效图层类型
    valid_types = {0, 1, 2, 3, 4, 5}
    if isinstance(ty, (int, float)) and int(ty) not in valid_types:
        add_warning(f"图层警告 [{layer_path}]: 未知的图层类型 ty={ty}")

    # 可见图层（非空对象图层）必须有变换属性
    if ty != 3:
        ks = layer.get("ks")
        if ks is None:
            add_error(f"图层错误 [{layer_path}]: 缺少 ks（变换属性）")
        else:
            validate_transform(ks, layer_path)

    # 形状图层必须有 shapes 数组
    if ty == 4:
        shapes = layer.get("shapes", layer.get("it"))
        if shapes is None:
            add_error(
                f"形状图层错误 [{layer_path}]: "
                f"缺少 shapes（形状数组）"
            )
        elif not isinstance(shapes, list):
            add_error(
                f"形状图层错误 [{layer_path}]: "
                f"shapes 必须是数组"
            )
        else:
            validate_shapes(shapes, layer_path)

    # 图层帧范围检查
    layer_ip = layer.get("ip")
    layer_op = layer.get("op")
    if (isinstance(layer_ip, (int, float)) and
            isinstance(layer_op, (int, float))):
        if layer_ip > layer_op:
            add_warning(
                f"图层警告 [{layer_path}]: "
                f"ip({layer_ip}) 大于 op({layer_op})"
            )


def validate_lottie(data: dict[str, Any]) -> bool:
    """
    主验证入口：依次验证顶层字段、帧范围、所有图层
    返回 True 表示验证通过，False 表示有错误
    """
    global errors
    errors = []

    # 第一步：验证顶层字段
    print("🔍 检查顶层字段...")
    validate_top_level(data)

    # 第二步：验证帧范围
    print("🔍 检查帧范围...")
    validate_frame_range(data)

    # 第三步：验证图层
    layers = data.get("layers", [])
    if isinstance(layers, list):
        print(f"🔍 检查 {len(layers)} 个图层...")
        if len(layers) == 0:
            add_warning("图层数组为空，动画将没有任何可见内容")
        for i, layer in enumerate(layers):
            if isinstance(layer, dict):
                validate_layer(layer, i)
            else:
                add_error(f"layers[{i}] 不是有效的图层对象")
    else:
        add_error("layers 字段不是数组")

    # 第四步：检查 assets（如果存在）
    assets = data.get("assets")
    if assets is not None and not isinstance(assets, list):
        add_error("assets 字段必须是数组")

    # 输出结果
    real_errors = [e for e in errors if e.startswith("❌")]
    warnings = [e for e in errors if e.startswith("⚠️")]

    if warnings:
        print(f"\n⚠️ 发现 {len(warnings)} 个警告：")
        for w in warnings:
            print(f"  {w}")

    if real_errors:
        print(f"\n❌ 验证失败！发现 {len(real_errors)} 个错误：")
        for e in real_errors:
            print(f"  {e}")
        return False
    else:
        print("\n✅ 验证通过！Lottie JSON 文件结构正确。")
        # 输出摘要信息
        w = data.get("w", "?")
        h = data.get("h", "?")
        fr = data.get("fr", "?")
        ip = data.get("ip", 0)
        op = data.get("op", 0)
        duration = (
            f"{(op - ip) / fr:.2f}s"
            if isinstance(op, (int, float)) and
            isinstance(ip, (int, float)) and
            isinstance(fr, (int, float)) and fr > 0
            else "?"
        )
        layer_count = len(layers) if isinstance(layers, list) else 0
        print(f"  📐 尺寸: {w}×{h}")
        print(f"  🎬 帧率: {fr}fps")
        print(f"  ⏱️  时长: {duration} ({ip}-{op}帧)")
        print(f"  📦 图层数: {layer_count}")
        return True


def main() -> None:
    """CLI 入口：读取并验证 Lottie JSON 文件"""
    # 检查命令行参数
    if len(sys.argv) < 2:
        print("用法: python3 validate_lottie.py <json文件路径>")
        print("示例: python3 validate_lottie.py spinner-circular_6C5CE7.json")
        sys.exit(1)

    file_path = Path(sys.argv[1])

    # 检查文件是否存在
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(1)

    # 检查文件扩展名
    if file_path.suffix.lower() != ".json":
        print(f"⚠️ 文件扩展名不是 .json: {file_path}")

    # 读取并解析 JSON
    print(f"📂 正在验证: {file_path}")
    print("-" * 50)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {e}")
        sys.exit(1)
    except OSError as e:
        print(f"❌ 文件读取失败: {e}")
        sys.exit(1)

    # 顶层必须是对象
    if not isinstance(data, dict):
        print("❌ Lottie JSON 顶层必须是对象（dict），当前类型: "
              f"{type(data).__name__}")
        sys.exit(1)

    # 执行验证
    success = validate_lottie(data)
    print("-" * 50)

    # 根据结果设置退出码
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
